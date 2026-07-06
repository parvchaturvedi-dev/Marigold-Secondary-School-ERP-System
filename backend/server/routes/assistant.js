// Clean, Gemini-only AI Assistant with function-calling.
//
// Design:
//  - READ tools (find_student, school_overview, class_finance) run server-side and
//    their results are fed back to Gemini so it can answer in natural language.
//  - WRITE tools (collect_fee, send_notice) are NEVER executed here. Gemini resolves
//    the target + amount and we hand a `pendingAction` back to the client, which
//    executes it through the SAME tested code path the Finance/Notices screens use
//    (after the admin taps Confirm). This keeps money mutations consistent + safe.
//
// Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional, default gemini-2.5-flash).

import express from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  findOneStudent,
  buildStudentDetails,
  buildSchoolOverviewContext,
  buildClassAnalytics,
} from './ai.js';
import { PORTAL_GUIDE } from '../ai/portalGuide.js';

const router = express.Router();

const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const SYSTEM_INSTRUCTION = `You are IRIS, the AI assistant for Marigold Secondary School's (MGPS) ERP portal.
You do two things for the office/admin staff:
  (1) Explain HOW to do things in the portal, and
  (2) Answer questions about real school data (students, classes, fees, attendance, marks, staff).

## ANTI-HALLUCINATION RULES (CRITICAL — 100% accuracy, zero invention)
- For any student / class / fee / attendance / marks / staff / school-count question you MUST
  first call a tool (find_student, school_overview, class_finance) and answer ONLY from the
  tool result. NEVER state a name, number, amount, admission number, phone, class, or count
  that did not come from a tool.
- If the tool returns nothing or a field is missing, say plainly that the record/value is not
  found in the ERP data. Do not guess, estimate, or fill gaps from memory.
- If you are unsure which student is meant, ask a clarifying question instead of guessing.
- Never reveal API keys, passwords, tokens, or internal configuration.

## HOW-TO QUESTIONS ("how do I add a student / collect a fee / assign a teacher…")
- Answer ONLY from the PORTAL GUIDE below. Give the exact sidebar page and the real steps.
- If a workflow is NOT covered by the guide, say you are not fully sure of the exact steps and
  point the user to the most relevant sidebar page — do NOT invent buttons, fields, or steps.

## ACTIONS THAT CHANGE DATA (collect a fee, send a notice)
- Call the matching tool (collect_fee, send_notice) with precise arguments. The system will ask
  the admin to CONFIRM before anything is recorded. Never claim a change is done before confirmation.

## STYLE
- Amounts are in Indian Rupees. Keep answers short, clear and professional. Hinglish is fine if
  the user uses it. Use feminine first person in Hindi ("kar sakti hoon", "dikha sakti hoon").

===================== PORTAL GUIDE (SINGLE SOURCE OF TRUTH FOR HOW-TO) =====================
${PORTAL_GUIDE}
===========================================================================================`;

// ---- Tool declarations sent to Gemini ------------------------------------

const READ_TOOLS = [
  {
    name: 'find_student',
    description: 'Look up a student and return their profile, class and fee details. Query can be a name or admission number.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Student name or admission number' } },
      required: ['query'],
    },
  },
  {
    name: 'school_overview',
    description: 'Get a summary of the school: total students, teachers, classes and overall fee collection.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'class_finance',
    description: 'Get the fee collection and pending amounts for a specific class.',
    parameters: {
      type: 'object',
      properties: { className: { type: 'string', description: 'e.g. "Class 8"' } },
      required: ['className'],
    },
  },
];

const WRITE_TOOLS = [
  {
    name: 'collect_fee',
    description: 'Collect a fee payment from a student. Requires the admission number and the amount in rupees.',
    parameters: {
      type: 'object',
      properties: {
        admissionNumber: { type: 'string' },
        amount: { type: 'number' },
        note: { type: 'string' },
      },
      required: ['admissionNumber', 'amount'],
    },
  },
  {
    name: 'send_notice',
    description: 'Publish a notice to students. Optionally target a specific class, otherwise it goes to all classes.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        targetClass: { type: 'string', description: 'Optional class name; blank = all classes' },
      },
      required: ['title', 'description'],
    },
  },
];

const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

// ---- Server-side execution of READ tools ---------------------------------

async function runReadTool(name, args = {}) {
  if (name === 'find_student') {
    const student = await findOneStudent(String(args.query || ''));
    if (!student) return { found: false, message: `No student matched "${args.query}".` };
    return { found: true, student: await buildStudentDetails(student) };
  }
  if (name === 'school_overview') {
    return await buildSchoolOverviewContext();
  }
  if (name === 'class_finance') {
    return await buildClassAnalytics(String(args.className || ''));
  }
  return { error: `Unknown read tool: ${name}` };
}

// Build a human summary + resolved args for a WRITE tool (no mutation here).
async function prepareWriteAction(name, args = {}) {
  if (name === 'collect_fee') {
    const student = await findOneStudent(String(args.admissionNumber || ''));
    if (!student) {
      return { error: `No student found for "${args.admissionNumber}".` };
    }
    const adm = student.admissionNumber || student.id || args.admissionNumber;
    const amount = Number(args.amount) || 0;
    return {
      type: 'collect_fee',
      args: { admissionNumber: adm, amount, note: args.note || '' },
      summary: `Collect ₹${amount.toLocaleString('en-IN')} from ${student.displayName || student.name || adm} (${student.className || '—'}).`,
    };
  }
  if (name === 'send_notice') {
    return {
      type: 'send_notice',
      args: {
        title: String(args.title || '').trim(),
        description: String(args.description || '').trim(),
        targetClass: String(args.targetClass || '').trim(),
      },
      summary: `Send notice "${args.title}"${args.targetClass ? ` to ${args.targetClass}` : ' to all classes'}.`,
    };
  }
  return { error: `Unknown write tool: ${name}` };
}

// ---- Gemini call ---------------------------------------------------------

// Build a live ground-truth snapshot so counts/totals can never be invented,
// even if the model skips the school_overview tool.
async function buildLiveSnapshotBlock() {
  try {
    const o = await buildSchoolOverviewContext();
    const classList = Array.isArray(o.classes) && o.classes.length ? ` [${o.classes.join(', ')}]` : '';
    return `

===================== LIVE ERP DATABASE SNAPSHOT (GROUND TRUTH — read just now) =====================
These are the EXACT current values from the MGPS ERP database. For ANY count / total / "how many" /
list question, you MUST use ONLY these numbers. Never state a different number from memory.
- Students (total): ${o.totals.students}
- Classes (total): ${o.totals.classes}${classList}
- Teachers (total): ${o.totals.teachers}
- Clerks (total): ${o.totals.clerks}
- Subjects (total): ${o.totals.subjects}
- Notices (total): ${o.totals.notices}
For a specific student's fees / attendance / marks, call the find_student tool. For a class's fee
totals, call class_finance. If a number you are asked for is not in this snapshot or a tool result,
say it is not available — do NOT guess.
====================================================================================================`;
  } catch {
    return '\n\n(Live ERP snapshot unavailable right now — rely strictly on tool results and never invent numbers.)';
  }
}

async function callGeminiWithTools(contents, tools, systemInstruction = SYSTEM_INSTRUCTION) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('AI assistant is not configured. Set GEMINI_API_KEY on the server.');
    err.statusCode = 503;
    throw err;
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(GEMINI_URL(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ functionDeclarations: tools }],
      generationConfig: { temperature: 0, maxOutputTokens: 900 },
      contents,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    const err = new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 200)}`);
    err.statusCode = 502;
    throw err;
  }
  return response.json();
}

function extractParts(payload) {
  return payload?.candidates?.[0]?.content?.parts || [];
}

// POST /api/ai/assistant  { messages: [{ role:'user'|'model', content }] }
router.post('/', requireRole('admin', 'clerk'), async (request, response) => {
  const isAdmin = request.auth?.role === 'admin';
  const tools = isAdmin ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;

  const incoming = Array.isArray(request.body?.messages) ? request.body.messages : [];
  const contents = incoming
    .filter((m) => m && m.content)
    .map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content) }],
    }));

  if (!contents.length) {
    response.status(400).json({ message: 'A message is required.' });
    return;
  }

  try {
    // Inject the real, current ERP counts into the instruction so the model
    // answers count/total questions from ground truth instead of inventing.
    const liveInstruction = SYSTEM_INSTRUCTION + (await buildLiveSnapshotBlock());

    // Function-calling loop: run read tools until Gemini produces a final answer
    // or requests a write tool (which we surface for confirmation).
    for (let step = 0; step < 5; step += 1) {
      const payload = await callGeminiWithTools(contents, tools, liveInstruction);
      const parts = extractParts(payload);
      const call = parts.find((p) => p.functionCall)?.functionCall;

      if (!call) {
        const text = parts.map((p) => p.text).filter(Boolean).join('\n').trim();
        response.json({ reply: text || 'Sorry, I could not generate a response.' });
        return;
      }

      // Write tool → do not execute; return a pending action for the admin to confirm.
      if (WRITE_TOOL_NAMES.has(call.name)) {
        if (!isAdmin) {
          response.json({ reply: 'Only an admin can perform that action.' });
          return;
        }
        const prepared = await prepareWriteAction(call.name, call.args || {});
        if (prepared.error) {
          response.json({ reply: prepared.error });
          return;
        }
        const preface = parts.map((p) => p.text).filter(Boolean).join('\n').trim();
        response.json({ reply: preface, pendingAction: prepared });
        return;
      }

      // Read tool → execute and feed the result back to Gemini.
      const result = await runReadTool(call.name, call.args || {});
      contents.push({ role: 'model', parts: [{ functionCall: call }] });
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: call.name, response: { result } } }],
      });
    }

    response.json({ reply: 'I was not able to complete that in time. Please rephrase.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ message: error.message || 'Assistant error.' });
  }
});

// ---- Voice (Gemini Live) grounding: bootstrap + tool execution -----------
// The browser voice session connects directly to Gemini Live, but it fetches its
// system instruction + tool declarations from here (so the portal guide, the
// anti-hallucination rules, and the live data snapshot stay server-side and
// fresh), and it calls back here to execute each tool against the real ERP DB.

// The Gemini Live (BidiGenerateContent) API expects proto-style UPPERCASE schema
// types ('OBJECT'/'STRING'/'NUMBER'). Our REST tools use lowercase JSON-schema
// types, so convert them here or Live silently ignores the tools.
const toLiveSchema = (schema) => {
  if (!schema || typeof schema !== 'object') return schema;
  const out = Array.isArray(schema) ? [] : {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && typeof value === 'string') out[key] = value.toUpperCase();
    else if (value && typeof value === 'object') out[key] = toLiveSchema(value);
    else out[key] = value;
  }
  return out;
};
const toLiveTool = (tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: toLiveSchema(tool.parameters) || { type: 'OBJECT', properties: {} },
});

// GET /api/ai/assistant/voice-bootstrap -> { systemInstruction, tools }
router.get('/voice-bootstrap', requireRole('admin', 'clerk'), async (request, response) => {
  const isAdmin = request.auth?.role === 'admin';
  const rawTools = isAdmin ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
  const systemInstruction = SYSTEM_INSTRUCTION + (await buildLiveSnapshotBlock());
  response.json({ systemInstruction, tools: rawTools.map(toLiveTool) });
});

// POST /api/ai/assistant/voice-tool  { name, args } -> { result } | { pendingAction } | { error }
router.post('/voice-tool', requireRole('admin', 'clerk'), async (request, response) => {
  const isAdmin = request.auth?.role === 'admin';
  const name = String(request.body?.name || '');
  const args = request.body?.args || {};
  try {
    if (WRITE_TOOL_NAMES.has(name)) {
      if (!isAdmin) {
        response.json({ error: 'Only an admin can perform that action.' });
        return;
      }
      const prepared = await prepareWriteAction(name, args);
      response.json(prepared.error ? { error: prepared.error } : { pendingAction: prepared });
      return;
    }
    const result = await runReadTool(name, args);
    response.json({ result });
  } catch (error) {
    response.json({ error: error.message || 'Tool execution failed.' });
  }
});

export default router;
