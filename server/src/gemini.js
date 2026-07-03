import { GoogleGenAI } from "@google/genai";

// A fast Gemini Flash model. The newer @google/genai SDK is required for the
// current "AQ." API key format issued by Google AI Studio.
// Configurable via GEMINI_MODEL so you can switch models (e.g. if one model's
// free-tier daily quota is exhausted) without a code change.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

// Thrown when Gemini is rate-limited / out of free-tier quota (HTTP 429).
export class QuotaError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuotaError";
    this.status = 429;
  }
}

// Transient Gemini errors worth retrying: 429 (rate limit / quota) and 503
// (model temporarily overloaded — "high demand"). Both usually clear quickly.
function isRetryable(err) {
  const status = err?.status || err?.code || err?.response?.status;
  return (
    status === 429 ||
    status === 503 ||
    /429|503|rate.?limit|quota|resource.?exhausted|exceeded|unavailable|overloaded|high demand/i.test(
      String(err?.message)
    )
  );
}

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Safety net: the reply is read aloud, so strip any placeholder brackets the
// model might emit (e.g. "[Interviewer Name]") so they are never spoken.
function sanitizeReply(text) {
  return text
    // Name placeholders -> the interviewer's actual name.
    .replace(/\[[^\]]*\bname\b[^\]]*\]/gi, "Maya")
    // Any other leftover bracketed placeholder -> remove.
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Runs a Gemini call with short exponential backoff on 429 errors. Kept brief
// (2 retries) so a hard quota cap fails fast instead of hanging the live
// interview for 10+ seconds; transient per-minute limits still get a couple
// of chances to clear.
async function withRetry(fn, { retries = 2, baseDelay = 600 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === retries) break;
      const delay = baseDelay * 2 ** attempt + Math.random() * 200;
      await sleep(delay);
    }
  }
  if (isRetryable(lastErr)) {
    throw new QuotaError(
      "The AI is temporarily rate-limited or overloaded (Gemini free tier). Wait a minute and try again, or switch GEMINI_MODEL / use a fresh key."
    );
  }
  throw lastErr;
}

/**
 * Generate the interviewer's next spoken line.
 * @param {string} systemPrompt
 * @param {Array<{role: "interviewer"|"candidate", content: string}>} history
 * @param {string} [extraInstruction] appended as a final user turn (e.g. opening)
 * @returns {Promise<string>}
 */
export async function generateInterviewerReply(systemPrompt, history, extraInstruction) {
  // Map our roles to Gemini roles: interviewer -> model, candidate -> user.
  const contents = history.map((m) => ({
    role: m.role === "interviewer" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  if (extraInstruction) {
    contents.push({ role: "user", parts: [{ text: extraInstruction }] });
  }

  const result = await withRetry(() =>
    getClient().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
        maxOutputTokens: 250,
        // Disable "thinking" — replies are short and we don't want internal
        // reasoning eating the output-token budget (which truncates the reply).
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
  );

  const text = (result.text || "").trim();
  if (!text) {
    const reason = result?.candidates?.[0]?.finishReason;
    throw new Error(`Empty response from Gemini (finishReason: ${reason})`);
  }
  return sanitizeReply(text);
}

/**
 * Generate raw JSON text for the feedback report.
 * @param {string} transcript full transcript text
 * @param {string} instruction REPORT_INSTRUCTION
 * @returns {Promise<string>} raw model text (should be JSON)
 */
export async function generateReportJson(transcript, instruction) {
  const prompt = `Interview transcript:\n\n${transcript}\n\n${instruction}`;

  const result = await withRetry(() =>
    getClient().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
  );

  return result.text.trim();
}
