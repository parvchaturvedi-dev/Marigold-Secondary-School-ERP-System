import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileImage,
  FileText,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  StickyNote,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiFetch } from './api';

const ITERATIONS = 210000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const bytesToBase64 = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const base64ToBytes = (base64) => {
  const binary = window.atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.readAsDataURL(file);
  });

const deriveKey = async (passphrase, saltBytes) => {
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations: ITERATIONS,
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptPayload = async (plainText, passphrase) => {
  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, saltBytes);
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    new TextEncoder().encode(plainText)
  );

  return {
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    encryption: {
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: ITERATIONS,
      salt: bytesToBase64(saltBytes),
      iv: bytesToBase64(ivBytes),
    },
  };
};

const decryptPayload = async (item, passphrase) => {
  const saltBytes = base64ToBytes(item.encryption.salt);
  const ivBytes = base64ToBytes(item.encryption.iv);
  const key = await deriveKey(passphrase, saltBytes);
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    base64ToBytes(item.encryptedPayload)
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
};

const DocumentVault = ({ title = 'Documents Vault', subtitle = 'Private encrypted space for your notes and important documents.' }) => {
  const [items, setItems] = useState([]);
  const [usage, setUsage] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeItem, setActiveItem] = useState(null);
  const [activePayload, setActivePayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadVault = async () => {
    setIsLoading(true);
    setError('');

    try {
      const payload = await apiFetch('/vault');
      setItems(payload.items || []);
      setUsage(payload.usage || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVault();
  }, []);

  const counts = usage?.counts || {};
  const usedPercent = usage?.storageLimitBytes
    ? Math.min(100, Math.round((usage.totalBytes / usage.storageLimitBytes) * 100))
    : 0;

  const groupedItems = useMemo(
    () => ({
      note: items.filter((item) => item.kind === 'note'),
      pdf: items.filter((item) => item.kind === 'pdf'),
      image: items.filter((item) => item.kind === 'image'),
    }),
    [items]
  );

  const unlockVault = (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (passphrase.trim().length < 8) {
      setError('Vault passphrase must contain at least 8 characters.');
      return;
    }

    setIsUnlocked(true);
    setMessage('Vault unlocked in this browser session.');
  };

  const saveEncryptedItem = async (itemPayload) => {
    if (!isUnlocked) {
      setError('Unlock the vault before saving.');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const encrypted = await encryptPayload(JSON.stringify(itemPayload.privateData), passphrase);
      const payload = await apiFetch('/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: itemPayload.kind,
          title: itemPayload.title,
          originalName: itemPayload.originalName || '',
          mimeType: itemPayload.mimeType || '',
          sizeBytes: itemPayload.sizeBytes || 0,
          ...encrypted,
        }),
      });
      setItems((current) => [payload.item, ...current]);
      setUsage(payload.usage || null);
      setMessage('Encrypted item saved to your vault.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const createNote = async (event) => {
    event.preventDefault();
    const titleValue = noteTitle.trim();
    const bodyValue = noteBody.trim();
    if (!titleValue || !bodyValue) return;

    await saveEncryptedItem({
      kind: 'note',
      title: titleValue,
      sizeBytes: new TextEncoder().encode(bodyValue).length,
      privateData: {
        type: 'note',
        body: bodyValue,
      },
    });
    setNoteTitle('');
    setNoteBody('');
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setError('Single file limit is 2 MB.');
      return;
    }

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      setError('Only PDF and image files are allowed.');
      return;
    }

    const kind = isPdf ? 'pdf' : 'image';
    const dataUrl = await readFileAsDataUrl(file);
    await saveEncryptedItem({
      kind,
      title: file.name.replace(/\.[^.]+$/, '') || file.name,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      privateData: {
        type: 'file',
        dataUrl,
        originalName: file.name,
        mimeType: file.type,
      },
    });
  };

  const openItem = async (item) => {
    if (!isUnlocked) {
      setError('Unlock the vault before opening an item.');
      return;
    }

    setError('');
    setMessage('');

    try {
      const payload = await decryptPayload(item, passphrase);
      setActiveItem(item);
      setActivePayload(payload);
    } catch {
      setError('Could not decrypt this item. Check your vault passphrase.');
    }
  };

  const downloadItem = async (item) => {
    if (!isUnlocked) {
      setError('Unlock the vault before downloading.');
      return;
    }

    try {
      const payload = activeItem?.id === item.id && activePayload ? activePayload : await decryptPayload(item, passphrase);
      if (payload.type !== 'file') return;
      const link = document.createElement('a');
      link.href = payload.dataUrl;
      link.download = payload.originalName || item.originalName || item.title;
      link.click();
    } catch {
      setError('Could not decrypt this file. Check your vault passphrase.');
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.title}" from your vault?`)) return;
    setError('');
    setMessage('');

    try {
      const payload = await apiFetch(`/vault/${item.id}`, {
        method: 'DELETE',
      });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setUsage(payload.usage || null);
      if (activeItem?.id === item.id) {
        setActiveItem(null);
        setActivePayload(null);
      }
      setMessage(payload.message || 'Vault item deleted.');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const renderItem = (item) => {
    const Icon = item.kind === 'image' ? FileImage : item.kind === 'pdf' ? FileText : StickyNote;

    return (
      <div key={item.id} className="rounded-lg border border-[#C8C8C8] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="rounded-lg border border-[#EAEAEA] bg-[#F8F8F8] p-2">
              <Icon className="h-4 w-4 text-[#1A1A1A]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#1A1A1A]">{item.title}</p>
              <p className="mt-1 text-[10px] font-bold uppercase text-[#555555]">
                {item.kind} | {formatBytes(item.sizeBytes)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => deleteItem(item)}
            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => openItem(item)}
            className="flex-1 rounded-lg bg-[#1A1A1A] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
            disabled={!isUnlocked}
          >
            Open
          </button>
          {item.kind !== 'note' && (
            <button
              type="button"
              onClick={() => downloadItem(item)}
              className="rounded-lg border border-[#C8C8C8] bg-white px-3 py-2 text-[#1A1A1A] disabled:opacity-60"
              disabled={!isUnlocked}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#1A1A1A]">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="text-xl font-black">{title}</h1>
          </div>
          <p className="mt-1 max-w-3xl text-xs font-semibold text-[#555555]">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadVault}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1A1A1A] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-[#C8C8C8] bg-white p-4">
          <p className="text-[10px] font-black uppercase text-[#555555]">Storage</p>
          <p className="mt-1 text-2xl font-black text-[#1A1A1A]">{usedPercent}%</p>
          <div className="mt-3 h-2 rounded-full bg-[#EAEAEA]">
            <div className="h-2 rounded-full bg-[#E1FA6C]" style={{ width: `${usedPercent}%` }} />
          </div>
          <p className="mt-2 text-[10px] font-bold text-[#555555]">
            {formatBytes(usage?.totalBytes || 0)} of {formatBytes(usage?.storageLimitBytes || 0)}
          </p>
        </div>
        <LimitTile label="Notes" value={counts.note || 0} limit={usage?.maxNotes || 20} />
        <LimitTile label="PDFs" value={counts.pdf || 0} limit={usage?.maxPdfs || 5} />
        <LimitTile label="Images" value={counts.image || 0} limit={usage?.maxImages || 5} />
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {message && (
        <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-4">
          <form onSubmit={unlockVault} className="rounded-lg border border-[#C8C8C8] bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-[#1A1A1A]">
              <Lock className="h-4 w-4" />
              Unlock Vault
            </h2>
            <p className="mt-1 text-[11px] font-semibold text-[#555555]">
              This passphrase encrypts and decrypts your items in the browser.
            </p>
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Minimum 8 characters"
              className="mt-4 w-full rounded-lg border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 text-sm font-semibold outline-none focus:border-[#1A1A1A]"
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-lg bg-[#E1FA6C] px-4 py-2 text-xs font-black text-[#1A1A1A] hover:bg-[#d4ee59]"
            >
              {isUnlocked ? 'Unlocked' : 'Unlock'}
            </button>
          </form>

          <form onSubmit={createNote} className="rounded-lg border border-[#C8C8C8] bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-[#1A1A1A]">
              <Plus className="h-4 w-4" />
              Create Note
            </h2>
            <input
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="Note title"
              className="mt-4 w-full rounded-lg border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 text-sm font-semibold outline-none focus:border-[#1A1A1A]"
              disabled={!isUnlocked}
            />
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Private note"
              rows={5}
              className="mt-3 w-full resize-none rounded-lg border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 text-sm font-semibold outline-none focus:border-[#1A1A1A]"
              disabled={!isUnlocked}
            />
            <button
              type="submit"
              disabled={!isUnlocked || isSaving}
              className="mt-3 w-full rounded-lg bg-[#1A1A1A] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              Save Encrypted Note
            </button>
          </form>

          <div className="rounded-lg border border-[#C8C8C8] bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-[#1A1A1A]">
              <Upload className="h-4 w-4" />
              Upload File
            </h2>
            <p className="mt-1 text-[11px] font-semibold text-[#555555]">
              Max 5 PDFs, 5 images, and 2 MB per file.
            </p>
            <label className={`mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#C8C8C8] bg-[#F8F8F8] px-4 py-6 text-xs font-black text-[#555555] ${!isUnlocked ? 'opacity-60' : ''}`}>
              Select PDF or Image
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={uploadFile}
                disabled={!isUnlocked || isSaving}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-2">
          {activeItem && activePayload && (
            <div className="rounded-lg border border-[#1A1A1A] bg-white p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-[#1A1A1A]">{activeItem.title}</h2>
                {activeItem.kind !== 'note' && (
                  <button
                    type="button"
                    onClick={() => downloadItem(activeItem)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1A1A1A] px-3 py-2 text-xs font-black text-white"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                )}
              </div>
              {activePayload.type === 'note' ? (
                <p className="whitespace-pre-wrap rounded-lg bg-[#F8F8F8] p-4 text-sm font-semibold leading-6 text-[#1A1A1A]">
                  {activePayload.body}
                </p>
              ) : activeItem.kind === 'image' ? (
                <img
                  src={activePayload.dataUrl}
                  alt={activeItem.title}
                  className="max-h-[460px] w-full rounded-lg border border-[#EAEAEA] object-contain"
                />
              ) : (
                <div className="rounded-lg border border-[#EAEAEA] bg-[#F8F8F8] p-5 text-xs font-bold text-[#555555]">
                  PDF decrypted. Use Download to open it.
                </div>
              )}
            </div>
          )}

          <VaultSection title="Notes" items={groupedItems.note} empty="No encrypted notes yet." renderItem={renderItem} isLoading={isLoading} />
          <VaultSection title="PDF Documents" items={groupedItems.pdf} empty="No PDF documents yet." renderItem={renderItem} isLoading={isLoading} />
          <VaultSection title="Images" items={groupedItems.image} empty="No images yet." renderItem={renderItem} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
};

const LimitTile = ({ label, value, limit }) => (
  <div className="rounded-lg border border-[#C8C8C8] bg-white p-4">
    <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
    <p className="mt-1 text-2xl font-black text-[#1A1A1A]">
      {value}
      <span className="text-sm text-[#555555]">/{limit}</span>
    </p>
  </div>
);

const VaultSection = ({ title, items, empty, renderItem, isLoading }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between border-b border-[#C8C8C8] pb-2">
      <h2 className="text-sm font-black text-[#1A1A1A]">{title}</h2>
      <span className="rounded-md bg-[#EAEAEA] px-2 py-1 text-[10px] font-black text-[#555555]">
        {items.length}
      </span>
    </div>
    {isLoading ? (
      <div className="rounded-lg border border-[#C8C8C8] bg-white p-8 text-center text-xs font-bold text-[#555555]">
        Loading vault...
      </div>
    ) : items.length ? (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{items.map(renderItem)}</div>
    ) : (
      <div className="rounded-lg border border-[#C8C8C8] bg-white p-8 text-center text-xs font-bold text-[#555555]">
        {empty}
      </div>
    )}
  </section>
);

export default DocumentVault;
