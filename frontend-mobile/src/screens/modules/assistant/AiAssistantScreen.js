// AI Assistant — admin/clerk chat that talks to POST /api/ai/assistant. The model
// can return a `pendingAction` the operator must confirm before it runs:
//   - send_notice  → POST /notifications (a class-wide student notice)
//   - collect_fee  → reuse the SAME fee waterfall as FinanceScreen via ./feeCore,
//                    persisting the student ledger back to module-state.
// Write actions are admin-only server-side already; this UI just gates the tile.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  ButtonRow,
  Card,
  PrimaryButton,
  ScreenShell,
  SmallButton,
  TextField,
  useBanner,
} from "../shared/formKit";
import {
  buildClassWiseReceipt,
  collectStudentPayment,
  formatCurrency,
  getClassOrder,
  getStudentAdmissionNumber,
  normalizeFinanceStudent,
} from "../finance/feeCore";

const STUDENTS_NS = "admin-student-management-students";
const PREFERENCES_NS = "admin-class-preferences";

const GREETING = {
  role: "model",
  content:
    "Hi! I'm your ERP assistant. Ask me to collect a student's fee or send a class notice, and I'll prepare it for your confirmation.",
};

// The assistant error surfaces as a thrown Error from apiRequest; detect the
// backend's 503 "GEMINI not configured" case so we can show a friendly line.
function isNotConfiguredError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("not configured") || msg.includes("gemini") || msg.includes("503");
}

export default function AiAssistantScreen({ user }) {
  const { palette } = useTheme();
  const banner = useBanner();
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const appendMessage = useCallback(
    (message) => {
      setMessages((prev) => [...prev, message]);
      scrollToEnd();
    },
    [scrollToEnd]
  );

  // Only send role/content pairs the backend understands (drop the local greeting
  // is fine — it's harmless context, but keep it minimal & well-shaped).
  const wireMessages = useCallback(
    (history) =>
      history
        .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content })),
    []
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    banner.clear();
    const userMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setPendingAction(null);
    setSending(true);
    scrollToEnd();

    try {
      const data = await apiRequest("/ai/assistant", {
        method: "POST",
        body: JSON.stringify({ messages: wireMessages(nextHistory) }),
      });
      const reply = data?.reply || "(no reply)";
      appendMessage({ role: "model", content: reply });
      if (data?.pendingAction) setPendingAction(data.pendingAction);
    } catch (err) {
      if (isNotConfiguredError(err)) {
        appendMessage({
          role: "model",
          content:
            "The AI assistant isn't configured on the server yet. An administrator needs to set the GEMINI_API_KEY environment variable to enable it.",
        });
      } else {
        appendMessage({ role: "model", content: `Sorry, something went wrong: ${err.message}` });
      }
    } finally {
      setSending(false);
    }
  }

  async function confirmSendNotice(args) {
    const { title, description, targetClass } = args || {};
    await apiRequest("/notifications", {
      method: "POST",
      body: JSON.stringify({
        title: title || "Notice",
        description: description || "",
        type: "notice",
        linkPage: "Notices",
        recipientRole: "student",
        recipientClassName: targetClass || "",
      }),
    });
    appendMessage({
      role: "model",
      content: `Notice "${title || "Notice"}" sent${targetClass ? ` to ${targetClass}` : " to all students"}.`,
    });
  }

  async function confirmCollectFee(args) {
    const { admissionNumber, amount, note } = args || {};
    const target = String(admissionNumber || "").trim();
    if (!target) throw new Error("No admission number was provided for this payment.");
    const payAmount = Number(amount);
    if (!Number.isFinite(payAmount) || payAmount <= 0) throw new Error("The payment amount is invalid.");

    // Load current students + class order, run the SAME waterfall as FinanceScreen.
    const [studentsPayload, prefsPayload] = await Promise.all([
      apiRequest(`/module-state/${STUDENTS_NS}`),
      apiRequest(`/module-state/${PREFERENCES_NS}`).catch(() => null),
    ]);
    const rawStudents = Array.isArray(studentsPayload?.value) ? studentsPayload.value : [];
    const classOrder = getClassOrder(prefsPayload?.value);

    // Find the student by admission number (via the same normalization web uses).
    let targetIndex = -1;
    for (let i = 0; i < rawStudents.length; i += 1) {
      const adm = normalizeFinanceStudent(rawStudents[i], i).admissionNumber;
      if (String(adm).toLowerCase() === target.toLowerCase()) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1) throw new Error(`No student found with admission number ${target}.`);

    const normalized = normalizeFinanceStudent(rawStudents[targetIndex], targetIndex);
    const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
    const nowISO = new Date().toISOString();
    const result = collectStudentPayment(normalized, payAmount, classOrder, receiptNo, nowISO);
    if (!result.breakdown.length) {
      throw new Error(`No pending balance found for ${normalized.name} (${target}).`);
    }

    // Replace in place (match on normalized admission number, like FinanceScreen).
    const next = rawStudents.map((student, index) => {
      const adm = normalizeFinanceStudent(student, index).admissionNumber;
      return String(adm).toLowerCase() === target.toLowerCase() ? result.student : student;
    });
    await apiRequest(`/module-state/${STUDENTS_NS}`, {
      method: "PUT",
      body: JSON.stringify({ value: next }),
    });

    const receipt = buildClassWiseReceipt({
      payerName: normalized.name,
      admissionNumber: getStudentAdmissionNumber(result.student),
      amount: payAmount,
      breakdown: result.breakdown,
      mode: "individual",
      contact: normalized.guardianPhone,
      guardianEmail: normalized.guardianEmail,
    });
    const lines = receipt.breakdown
      .map((row) => `  • ${row.className}: ${formatCurrency(row.amount)}`)
      .join("\n");
    const leftover = result.remaining > 0 ? `\nUnapplied (no dues left): ${formatCurrency(result.remaining)}` : "";
    appendMessage({
      role: "model",
      content:
        `Receipt ${receipt.receiptNo} committed for ${normalized.name} (${target}).\n` +
        `Collected ${formatCurrency(payAmount)}:\n${lines}${leftover}` +
        (note ? `\nNote: ${note}` : ""),
    });
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    // collect_fee is a write action — admin only (server enforces too).
    if (pendingAction.type === "collect_fee" && !isAdmin) {
      banner.showError("Only administrators can collect fees.");
      return;
    }
    setConfirming(true);
    banner.clear();
    try {
      if (pendingAction.type === "send_notice") {
        await confirmSendNotice(pendingAction.args);
      } else if (pendingAction.type === "collect_fee") {
        await confirmCollectFee(pendingAction.args);
      } else {
        appendMessage({ role: "model", content: `Unsupported action: ${pendingAction.type}.` });
      }
      setPendingAction(null);
    } catch (err) {
      banner.showError(err);
      appendMessage({ role: "model", content: `Could not complete the action: ${err.message}` });
      setPendingAction(null);
    } finally {
      setConfirming(false);
    }
  }

  function handleCancel() {
    setPendingAction(null);
    appendMessage({ role: "model", content: "Okay, cancelled. Anything else?" });
  }

  const pendingBlockedForRole = pendingAction?.type === "collect_fee" && !isAdmin;

  const chat = useMemo(
    () =>
      messages.map((m, index) => {
        const mine = m.role === "user";
        return (
          <View
            key={index}
            style={[styles.bubbleRow, { justifyContent: mine ? "flex-end" : "flex-start" }]}
          >
            <View
              style={[
                styles.bubble,
                mine
                  ? { backgroundColor: palette.accent || "#6366F1", borderBottomRightRadius: 4 }
                  : { backgroundColor: palette.tile || "rgba(148,163,184,0.18)", borderBottomLeftRadius: 4 },
              ]}
            >
              <Text style={[styles.bubbleText, { color: mine ? "#fff" : palette.ink }]}>{m.content}</Text>
            </View>
          </View>
        );
      }),
    [messages, palette]
  );

  return (
    <ScreenShell title="AI Assistant">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Banner type="error" message={banner.error} />

        <Card>
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={{ paddingVertical: 4 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToEnd}
          >
            {chat}
            {sending && (
              <View style={[styles.bubbleRow, { justifyContent: "flex-start" }]}>
                <View style={[styles.bubble, { backgroundColor: palette.tile || "rgba(148,163,184,0.18)" }]}>
                  <ActivityIndicator color={palette.accent || "#6366F1"} />
                </View>
              </View>
            )}
          </ScrollView>
        </Card>

        {!!pendingAction && (
          <Card>
            <Text style={[styles.confirmTitle, { color: palette.ink }]}>
              {pendingAction.type === "collect_fee" ? "Confirm Fee Collection" : "Confirm Action"}
            </Text>
            <Text style={[styles.confirmSummary, { color: palette.inkSoft }]}>
              {pendingAction.summary || "Please confirm this action."}
            </Text>
            {pendingBlockedForRole && (
              <Text style={[styles.confirmBlocked, { color: "#DC2626" }]}>
                Fee collection is restricted to administrators.
              </Text>
            )}
            <ButtonRow>
              <SmallButton
                label="Confirm"
                icon="checkmark-outline"
                onPress={handleConfirm}
                disabled={confirming || pendingBlockedForRole}
              />
              <SmallButton
                label="Cancel"
                icon="close-outline"
                tone="danger"
                onPress={handleCancel}
                disabled={confirming}
              />
            </ButtonRow>
            {confirming && (
              <View style={{ marginTop: 10 }}>
                <ActivityIndicator color={palette.accent || "#6366F1"} />
              </View>
            )}
          </Card>
        )}

        <Card>
          <TextField
            value={input}
            onChangeText={setInput}
            placeholder="Ask the assistant..."
            multiline
            onSubmitEditing={handleSend}
          />
          <PrimaryButton icon="send-outline" label="Send" onPress={handleSend} loading={sending} disabled={!input.trim()} />
        </Card>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = {
  chatScroll: { maxHeight: 420, minHeight: 220 },
  bubbleRow: { flexDirection: "row", marginBottom: 8 },
  bubble: { maxWidth: "82%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  confirmTitle: { fontSize: 15, fontWeight: "900", marginBottom: 6 },
  confirmSummary: { fontSize: 13, fontWeight: "700", lineHeight: 19, marginBottom: 8 },
  confirmBlocked: { fontSize: 12, fontWeight: "800", marginBottom: 6 },
};
