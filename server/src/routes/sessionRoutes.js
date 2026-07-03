import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { generateInterviewerReply, generateReportJson } from "../gemini.js";
import {
  systemPromptFor,
  INTERVIEW_TYPES,
  openingInstructionFor,
  REPORT_INSTRUCTION,
  WRAP_UP_INSTRUCTION,
  CLOSE_NOW_INSTRUCTION,
  WRAP_UP_AFTER,
  CLOSE_AFTER,
  looksLikeClosing,
} from "../prompts.js";
import { reportSchema, cleanJsonText } from "../reportSchema.js";

const router = Router();
router.use(requireAuth);

// Loads a session owned by the current user, or returns null.
async function ownedSession(sessionId, userId) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) return null;
  return session;
}

// POST /sessions — create a session and get the interviewer's opening line.
router.post("/", async (req, res) => {
  // Interview type picked on the selection screen. Default to HR if omitted.
  const interviewType = INTERVIEW_TYPES.includes(req.body?.interviewType)
    ? req.body.interviewType
    : "hr";

  const session = await prisma.session.create({
    data: { userId: req.userId, interviewType, status: "active" },
  });

  let opening;
  try {
    opening = await generateInterviewerReply(
      systemPromptFor(interviewType),
      [],
      openingInstructionFor(interviewType)
    );
  } catch (err) {
    console.error("Gemini opening failed:", err.message);
    const status = err?.status === 429 ? 429 : 502;
    return res
      .status(status)
      .json({ error: err?.status === 429 ? err.message : "Failed to start interview" });
  }

  await prisma.message.create({
    data: { sessionId: session.id, role: "interviewer", content: opening },
  });

  res.status(201).json({ sessionId: session.id, reply: opening });
});

const messageSchema = z.object({ text: z.string().min(1) });

// POST /sessions/:id/message — candidate speaks; get the interviewer's reply.
router.post("/:id/message", async (req, res) => {
  const session = await ownedSession(req.params.id, req.userId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.status !== "active") {
    return res.status(400).json({ error: "Session is not active" });
  }

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  // Save the candidate's answer.
  await prisma.message.create({
    data: { sessionId: session.id, role: "candidate", content: parsed.data.text },
  });

  // Load the full history in order.
  const history = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  // As the interview runs long, nudge the interviewer to wrap up / close so it
  // ends naturally instead of probing forever.
  const candidateTurns = history.filter((m) => m.role === "candidate").length;
  let extraInstruction;
  if (candidateTurns >= CLOSE_AFTER) extraInstruction = CLOSE_NOW_INSTRUCTION;
  else if (candidateTurns >= WRAP_UP_AFTER) extraInstruction = WRAP_UP_INSTRUCTION;

  let reply;
  try {
    reply = await generateInterviewerReply(
      systemPromptFor(session.interviewType),
      history,
      extraInstruction
    );
  } catch (err) {
    console.error("Gemini reply failed:", err.message);
    const status = err?.status === 429 ? 429 : 502;
    return res
      .status(status)
      .json({ error: err?.status === 429 ? err.message : "Failed to generate reply" });
  }

  await prisma.message.create({
    data: { sessionId: session.id, role: "interviewer", content: reply },
  });

  // Signal the frontend when the interviewer has closed the interview, so it
  // can transition the candidate to feedback. Guarded by turn count to avoid
  // treating a mid-interview "thank you" as the end. Past the hard cap we
  // forced a close, so mark done regardless of the heuristic.
  const done =
    candidateTurns >= CLOSE_AFTER ||
    (candidateTurns >= WRAP_UP_AFTER && looksLikeClosing(reply));

  res.json({ reply, done });
});

// POST /sessions/:id/end — complete the session and generate the report.
router.post("/:id/end", async (req, res) => {
  const session = await ownedSession(req.params.id, req.userId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  // Ending is an explicit user action: mark the session completed FIRST so it
  // can never dangle as "active"/"In progress", even if report generation
  // fails afterwards (e.g. Gemini free-tier rate limits). The report is a
  // separate artifact that can be retried later.
  if (session.status !== "completed") {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "completed", endedAt: new Date() },
    });
  }

  // Return an already-generated report if one exists (idempotent).
  const existingReport = await prisma.report.findUnique({
    where: { sessionId: session.id },
  });
  if (existingReport) {
    return res.json({ report: existingReport.data });
  }

  const messages = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const transcript = messages
    .map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`)
    .join("\n");

  const report = await generateValidatedReport(transcript);
  if (!report) {
    // The session is already completed above; the report can be regenerated
    // from the report screen. Signal that it's pending, not that ending failed.
    return res.status(502).json({
      error:
        "Interview saved, but the feedback report couldn't be generated (likely rate limits). Open it from your dashboard to try again.",
      reportPending: true,
    });
  }

  await prisma.report.create({
    data: { sessionId: session.id, data: report },
  });

  res.json({ report });
});

// GET /sessions — list the user's sessions with score if reported.
router.get("/", async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.userId },
    orderBy: { startedAt: "desc" },
    include: { report: { select: { data: true } } },
  });

  const list = sessions.map((s) => ({
    id: s.id,
    interviewType: s.interviewType,
    status: s.status,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    overallScore: s.report?.data?.overallScore ?? null,
  }));

  res.json({ sessions: list });
});

// GET /sessions/:id/report — return a session's stored report.
router.get("/:id/report", async (req, res) => {
  const session = await ownedSession(req.params.id, req.userId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const report = await prisma.report.findUnique({
    where: { sessionId: session.id },
  });
  if (!report) return res.status(404).json({ error: "Report not found" });

  res.json({ report: report.data });
});

const experienceSchema = z.object({
  rating: z.number().int().min(1).max(5),
  aiComment: z.string().max(2000).optional().default(""),
  techIssues: z.string().max(2000).optional().default(""),
  comments: z.string().max(2000).optional().default(""),
});

// GET /sessions/:id/experience — has the candidate already given feedback?
router.get("/:id/experience", async (req, res) => {
  const session = await ownedSession(req.params.id, req.userId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const fb = await prisma.experienceFeedback.findUnique({
    where: { sessionId: session.id },
  });
  res.json({ submitted: !!fb });
});

// POST /sessions/:id/experience — candidate rates their interview experience.
router.post("/:id/experience", async (req, res) => {
  const session = await ownedSession(req.params.id, req.userId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const parsed = experienceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { rating, aiComment, techIssues, comments } = parsed.data;
  // One feedback per session; allow updating if resubmitted.
  await prisma.experienceFeedback.upsert({
    where: { sessionId: session.id },
    update: { rating, aiComment, techIssues, comments },
    create: { sessionId: session.id, rating, aiComment, techIssues, comments },
  });

  res.status(201).json({ ok: true });
});

// Calls Gemini for the report and validates with zod, retrying once on failure.
async function generateValidatedReport(transcript) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateReportJson(transcript, REPORT_INSTRUCTION);
      const parsed = JSON.parse(cleanJsonText(raw));
      const result = reportSchema.safeParse(parsed);
      if (result.success) return result.data;
      console.warn("Report failed zod validation:", result.error.flatten());
    } catch (err) {
      console.warn(`Report generation attempt ${attempt + 1} failed:`, err.message);
    }
  }
  return null;
}

export default router;
