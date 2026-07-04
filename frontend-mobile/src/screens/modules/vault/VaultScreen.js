// Documents Vault (mobile) — client-side encrypted notes/PDFs/images.
// Encryption is byte-for-byte interoperable with the web DocumentVault.jsx:
//   KDF   : PBKDF2-HMAC-SHA256, 210000 iterations, 16-byte random salt, 256-bit key
//   Cipher: AES-256-GCM, 12-byte random IV, ciphertext||16-byte-tag (noble appends the tag,
//           exactly like WebCrypto's subtle.encrypt output)
//   Encode: salt / iv / encryptedPayload are all base64 of the raw bytes
//   Plain : JSON.stringify(privateData) — {type:'note',body} or {type:'file',dataUrl,originalName,mimeType}
// A note/file encrypted here decrypts on the web with the same passphrase and vice-versa.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import { gcm } from "@noble/ciphers/aes";

import {
  Banner,
  ButtonRow,
  Card,
  EmptyState,
  Field,
  GhostButton,
  Hero,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  SmallButton,
  TextArea,
  TextField,
  useBanner,
} from "../shared/formKit";
import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";

// ---- Crypto constants (must match web) ------------------------------------
const ITERATIONS = 210000;
const KEY_BYTES = 32; // AES-256
const SALT_BYTES = 16;
const IV_BYTES = 12;

// ---- Limits (match backend, enforced client-side) -------------------------
const MAX_PDFS = 5;
const MAX_IMAGES = 5;
const MAX_NOTES = 20;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_ITEM_BYTES = 2 * 1024 * 1024;

// ---- base64 helpers (RN has no window.btoa/atob) --------------------------
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

function base64ToBytes(base64) {
  const clean = String(base64).replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const bytesLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(bytesLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e0 = B64.indexOf(clean[i]);
    const e1 = B64.indexOf(clean[i + 1]);
    const e2 = i + 2 < len ? B64.indexOf(clean[i + 2]) : -1;
    const e3 = i + 3 < len ? B64.indexOf(clean[i + 3]) : -1;
    if (p < bytesLen) bytes[p++] = (e0 << 2) | (e1 >> 4);
    if (e2 !== -1 && p < bytesLen) bytes[p++] = ((e1 & 15) << 4) | (e2 >> 2);
    if (e3 !== -1 && p < bytesLen) bytes[p++] = ((e2 & 3) << 6) | e3;
  }
  return bytes;
}

// UTF-8 encode/decode (TextEncoder/Decoder exist in Hermes, but keep it robust)
function utf8Encode(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  return base64ToBytes(globalThis.btoa(unescape(encodeURIComponent(str))));
}
function utf8Decode(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  return decodeURIComponent(escape(String.fromCharCode(...bytes)));
}

function randomBytes(n) {
  const arr = new Uint8Array(n);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < n; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

function deriveKey(passphrase, saltBytes) {
  return pbkdf2(sha256, utf8Encode(passphrase), saltBytes, { c: ITERATIONS, dkLen: KEY_BYTES });
}

// Returns { encryptedPayload, encryption } matching the web contract exactly.
function encryptPayload(plainText, passphrase) {
  const saltBytes = randomBytes(SALT_BYTES);
  const ivBytes = randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, saltBytes);
  const cipher = gcm(key, ivBytes);
  const encrypted = cipher.encrypt(utf8Encode(plainText)); // ciphertext || 16-byte tag
  return {
    encryptedPayload: bytesToBase64(encrypted),
    encryption: {
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: ITERATIONS,
      salt: bytesToBase64(saltBytes),
      iv: bytesToBase64(ivBytes),
    },
  };
}

// Decrypts a stored item; throws if the passphrase is wrong (GCM tag mismatch).
function decryptPayload(item, passphrase) {
  const saltBytes = base64ToBytes(item.encryption.salt);
  const ivBytes = base64ToBytes(item.encryption.iv);
  const key = deriveKey(passphrase, saltBytes);
  const cipher = gcm(key, ivBytes);
  const decrypted = cipher.decrypt(base64ToBytes(item.encryptedPayload));
  return JSON.parse(utf8Decode(decrypted));
}

// ---- formatting -----------------------------------------------------------
function formatBytes(bytes = 0) {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

const KIND_ICON = { note: "document-text-outline", pdf: "document-outline", image: "image-outline" };

export default function VaultScreen() {
  const { palette } = useTheme();
  const [items, setItems] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [passphrase, setPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const [revealId, setRevealId] = useState(null);
  const [revealPayload, setRevealPayload] = useState(null);

  const { error, success, showError, showSuccess, clear } = useBanner();

  const loadVault = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiRequest("/vault");
      setItems(payload.items || []);
      setUsage(payload.usage || null);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  const counts = useMemo(
    () => ({
      note: items.filter((i) => i.kind === "note").length,
      pdf: items.filter((i) => i.kind === "pdf").length,
      image: items.filter((i) => i.kind === "image").length,
    }),
    [items]
  );

  const totalBytes = usage?.totalBytes ?? items.reduce((sum, i) => sum + (i.sizeBytes || 0), 0);
  const storageLimit = usage?.storageLimitBytes || MAX_TOTAL_BYTES;
  const usedPercent = storageLimit ? Math.min(100, Math.round((totalBytes / storageLimit) * 100)) : 0;

  const unlockVault = () => {
    clear();
    if (passphrase.trim().length < 8) {
      showError("Vault passphrase must contain at least 8 characters.");
      return;
    }
    setUnlocked(true);
    showSuccess("Vault unlocked for this session.");
  };

  const saveEncryptedItem = async ({ kind, title, originalName, mimeType, sizeBytes, privateData }) => {
    if (!unlocked) {
      showError("Unlock the vault before saving.");
      return false;
    }
    if (sizeBytes > MAX_ITEM_BYTES) {
      showError("Single item limit is 2 MB.");
      return false;
    }
    if (totalBytes + sizeBytes > storageLimit) {
      showError("Vault storage limit (8 MB) reached.");
      return false;
    }
    if (kind === "note" && counts.note >= MAX_NOTES) {
      showError(`Note limit reached (${MAX_NOTES}).`);
      return false;
    }
    if (kind === "pdf" && counts.pdf >= MAX_PDFS) {
      showError(`PDF limit reached (${MAX_PDFS}).`);
      return false;
    }
    if (kind === "image" && counts.image >= MAX_IMAGES) {
      showError(`Image limit reached (${MAX_IMAGES}).`);
      return false;
    }

    setSaving(true);
    clear();
    try {
      const encrypted = encryptPayload(JSON.stringify(privateData), passphrase);
      const payload = await apiRequest("/vault", {
        method: "POST",
        body: JSON.stringify({
          kind,
          title,
          originalName: originalName || "",
          mimeType: mimeType || "",
          sizeBytes: sizeBytes || 0,
          ...encrypted,
        }),
      });
      if (payload.item) setItems((cur) => [payload.item, ...cur]);
      else await loadVault();
      if (payload.usage) setUsage(payload.usage);
      showSuccess("Encrypted item saved to your vault.");
      return true;
    } catch (err) {
      showError(err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createNote = async () => {
    const title = noteTitle.trim();
    const body = noteBody.trim();
    if (!title || !body) {
      showError("Note needs a title and body.");
      return;
    }
    const ok = await saveEncryptedItem({
      kind: "note",
      title,
      sizeBytes: utf8Encode(body).length,
      privateData: { type: "note", body },
    });
    if (ok) {
      setNoteTitle("");
      setNoteBody("");
    }
  };

  const uploadFile = async () => {
    if (!unlocked) {
      showError("Unlock the vault before uploading.");
      return;
    }
    let res;
    try {
      res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        multiple: false,
        copyToCacheDirectory: true,
      });
    } catch (err) {
      showError(err);
      return;
    }
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    const mime = asset.mimeType || "application/octet-stream";
    const isPdf = mime === "application/pdf";
    const isImage = mime.startsWith("image/");
    if (!isPdf && !isImage) {
      showError("Only PDF and image files are allowed.");
      return;
    }
    const size = asset.size || 0;
    if (size > MAX_ITEM_BYTES) {
      showError("Single file limit is 2 MB.");
      return;
    }

    setSaving(true);
    clear();
    let base64;
    try {
      base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
    } catch (err) {
      setSaving(false);
      showError(err);
      return;
    }
    setSaving(false);

    const name = asset.name || (isPdf ? "document.pdf" : "image");
    const dataUrl = `data:${mime};base64,${base64}`;
    await saveEncryptedItem({
      kind: isPdf ? "pdf" : "image",
      title: name.replace(/\.[^.]+$/, "") || name,
      originalName: name,
      mimeType: mime,
      sizeBytes: size || base64ToBytes(base64).length,
      privateData: { type: "file", dataUrl, originalName: name, mimeType: mime },
    });
  };

  const revealItem = (item) => {
    if (!unlocked) {
      showError("Unlock the vault before opening an item.");
      return;
    }
    if (revealId === item.id) {
      setRevealId(null);
      setRevealPayload(null);
      return;
    }
    clear();
    try {
      const payload = decryptPayload(item, passphrase);
      setRevealId(item.id);
      setRevealPayload(payload);
    } catch {
      setRevealId(null);
      setRevealPayload(null);
      showError("Could not decrypt this item. Check your vault passphrase.");
    }
  };

  const deleteItem = (item) => {
    Alert.alert("Delete item", `Delete "${item.title}" from your vault?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          clear();
          try {
            const payload = await apiRequest(`/vault/${item.id}`, { method: "DELETE" });
            setItems((cur) => cur.filter((entry) => entry.id !== item.id));
            if (payload?.usage) setUsage(payload.usage);
            if (revealId === item.id) {
              setRevealId(null);
              setRevealPayload(null);
            }
            showSuccess(payload?.message || "Vault item deleted.");
          } catch (err) {
            showError(err);
          }
        },
      },
    ]);
  };

  const renderItem = (item) => {
    const revealed = revealId === item.id && revealPayload;
    return (
      <Card key={item.id}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.ink }]}>{item.title}</Text>
            <Text style={[styles.meta, { color: palette.inkSoft }]}>
              {item.kind.toUpperCase()} · {formatBytes(item.sizeBytes)}
            </Text>
          </View>
        </View>

        {revealed && revealPayload.type === "note" && (
          <View style={[styles.noteBox, { borderColor: palette.cardBorder }]}>
            <Text style={[styles.noteText, { color: palette.ink }]}>{revealPayload.body}</Text>
          </View>
        )}
        {revealed && revealPayload.type === "file" && item.kind === "image" && (
          <Image
            source={{ uri: revealPayload.dataUrl }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
        )}
        {revealed && revealPayload.type === "file" && item.kind === "pdf" && (
          <View style={[styles.noteBox, { borderColor: palette.cardBorder }]}>
            <Text style={[styles.noteText, { color: palette.ink }]}>PDF decrypted successfully. {item.originalName || item.title}</Text>
          </View>
        )}

        <ButtonRow>
          <SmallButton
            icon={revealId === item.id ? "eye-off-outline" : "eye-outline"}
            label={revealId === item.id ? "Hide" : "Reveal"}
            onPress={() => revealItem(item)}
            disabled={!unlocked}
            active={revealId === item.id}
          />
          <SmallButton icon="trash-outline" label="Delete" tone="danger" onPress={() => deleteItem(item)} />
        </ButtonRow>
      </Card>
    );
  };

  const kinds = [
    { key: "note", label: "Notes", limit: MAX_NOTES, empty: "No encrypted notes yet." },
    { key: "pdf", label: "PDF Documents", limit: MAX_PDFS, empty: "No PDF documents yet." },
    { key: "image", label: "Images", limit: MAX_IMAGES, empty: "No images yet." },
  ];

  return (
    <ScreenShell title="Documents Vault" refreshing={loading} onRefresh={loadVault}>
      <Hero
        icon="shield-checkmark-outline"
        title="Documents Vault"
        subtitle="Private, end-to-end encrypted space. Items are encrypted on this device with your passphrase — it is never stored."
      />

      <Banner type="error" message={error} />
      <Banner type="success" message={success} />

      <Card>
        <SectionTitle>Storage</SectionTitle>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${usedPercent}%` }]} />
        </View>
        <Text style={[styles.meta, { color: palette.inkSoft }]}>
          {formatBytes(totalBytes)} of {formatBytes(storageLimit)} · {usedPercent}%
        </Text>
        <View style={styles.countRow}>
          <Text style={[styles.countPill, { color: palette.inkLabel, backgroundColor: palette.tile }]}>Notes {counts.note}/{MAX_NOTES}</Text>
          <Text style={[styles.countPill, { color: palette.inkLabel, backgroundColor: palette.tile }]}>PDFs {counts.pdf}/{MAX_PDFS}</Text>
          <Text style={[styles.countPill, { color: palette.inkLabel, backgroundColor: palette.tile }]}>Images {counts.image}/{MAX_IMAGES}</Text>
        </View>
      </Card>

      <Card>
        <SectionTitle>Unlock Vault</SectionTitle>
        <TextField
          label="Passphrase"
          value={passphrase}
          onChangeText={setPassphrase}
          placeholder="Minimum 8 characters"
          secureTextEntry
          autoCapitalize="none"
          hint="Encrypts and decrypts your items on this device. Same passphrase as the web vault."
        />
        <PrimaryButton
          icon={unlocked ? "lock-open-outline" : "lock-closed-outline"}
          label={unlocked ? "Unlocked" : "Unlock"}
          onPress={unlockVault}
        />
      </Card>

      <Card>
        <SectionTitle>Create Note</SectionTitle>
        <TextField
          label="Title"
          value={noteTitle}
          onChangeText={setNoteTitle}
          placeholder="Note title"
          editable={unlocked}
        />
        <TextArea
          label="Note"
          value={noteBody}
          onChangeText={setNoteBody}
          placeholder="Private note"
          editable={unlocked}
        />
        <PrimaryButton
          icon="add-outline"
          label="Save Encrypted Note"
          onPress={createNote}
          disabled={!unlocked}
          loading={saving}
        />
      </Card>

      <Card>
        <SectionTitle>Upload File</SectionTitle>
        <Field label="PDF or Image" hint="Max 5 PDFs, 5 images, 2 MB per file, 8 MB total.">
          <GhostButton
            icon="cloud-upload-outline"
            label="Select PDF or Image"
            onPress={uploadFile}
            disabled={!unlocked || saving}
          />
        </Field>
      </Card>

      {loading ? (
        <LoadingCard text="Loading vault..." />
      ) : (
        kinds.map(({ key, label, empty }) => {
          const group = items.filter((i) => i.kind === key);
          return (
            <View key={key}>
              <SectionTitle right={<Text style={[styles.sectionCount, { color: palette.accentDeep, backgroundColor: palette.tile }]}>{group.length}</Text>}>{label}</SectionTitle>
              {group.length ? (
                group.map(renderItem)
              ) : (
                <EmptyState icon={KIND_ICON[key]} title={empty} text="Encrypted items appear here." />
              )}
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = {
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  meta: { color: "#64748B", fontSize: 12, fontWeight: "700", marginTop: 4 },
  sectionCount: {
    color: "#4F46E5",
    fontWeight: "900",
    fontSize: 12,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  noteBox: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  noteText: { color: "#0F172A", fontSize: 14, fontWeight: "600", lineHeight: 21 },
  imagePreview: { marginTop: 12, width: "100%", height: 240, borderRadius: 12, backgroundColor: "#F1F5F9" },
  barTrack: { height: 8, borderRadius: 6, backgroundColor: "rgba(148,163,184,0.25)", overflow: "hidden", marginTop: 4 },
  barFill: { height: 8, borderRadius: 6, backgroundColor: "#6366F1" },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  countPill: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
  },
};
