import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api.js";
import { useSpeech } from "../hooks/useSpeech.js";
import { typeLabel } from "../interviewTypes.js";

const INTERVIEW_SECONDS = 30 * 60; // 30-minute interview

// Interview states: connecting → speaking (AI) → ready (your turn) →
// listening → thinking (waiting on AI) → ... → ending
export default function Interview() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const speech = useSpeech();

  const [transcript, setTranscript] = useState([]); // { role, content }
  const [phase, setPhase] = useState("connecting");
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(INTERVIEW_SECONDS);

  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const transcriptEndRef = useRef(null);

  const label = typeLabel(location.state?.type);

  // Kick off the interview: speak the opening line (passed from dashboard,
  // or fetched if the page was loaded directly).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function begin() {
      let opening = location.state?.opening;
      if (!opening) {
        // Reloaded / direct nav — pull the latest interviewer line isn't
        // exposed, so start a message-less flow is impossible; send the user
        // back to the dashboard to start fresh.
        setError("Interview session must be started from the dashboard.");
        setPhase("error");
        return;
      }
      addLine("interviewer", opening);
      setPhase("speaking");
      await speech.speak(opening);
      setPhase("ready");
    }

    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, speech.interim]);

  function addLine(role, content) {
    setTranscript((t) => [...t, { role, content }]);
  }

  function handleMicClick() {
    if (phase === "listening") {
      // Stop and submit.
      speech.stopListening();
      return;
    }
    // From "ready" or "speaking" (barge-in): interrupt any speech and listen.
    if (phase === "speaking") speech.cancelSpeaking();
    setPhase("listening");
    speech.startListening(handleAnswer);
  }

  async function handleAnswer(text) {
    if (!text) {
      // Nothing captured — return to ready.
      setPhase("ready");
      return;
    }
    setError(""); // clear any stale error from a previous turn
    addLine("candidate", text);
    setPhase("thinking");
    try {
      const { data } = await api.post(
        `/sessions/${id}/message`,
        { text },
        { timeout: 60000 }
      );
      addLine("interviewer", data.reply);
      setPhase("speaking");
      await speech.speak(data.reply);
      // If the interviewer closed the interview, move to the completion state.
      setPhase(data.done ? "closed" : "ready");
    } catch (err) {
      const msg =
        err.code === "ECONNABORTED"
          ? "That took too long. Click the mic to try again."
          : (err.response?.data?.error || "Failed to get a reply") +
            " Click the mic to try again.";
      setError(msg);
      // Always return control to the candidate so the interview never wedges.
      setPhase("ready");
    }
  }

  async function endInterview() {
    if (endedRef.current) return; // guard against timer + button double-fire
    endedRef.current = true;
    setEnding(true);
    speech.cancelSpeaking();
    try {
      await api.post(`/sessions/${id}/end`);
      navigate(`/report/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to end interview");
      setEnding(false);
      endedRef.current = false; // allow a retry
    }
  }

  // 30-minute countdown. Ticks while the interview is live.
  useEffect(() => {
    if (["connecting", "closed", "error"].includes(phase)) return;
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, phase]);

  // When time runs out, end via the SAME flow as the End button.
  useEffect(() => {
    if (secondsLeft === 0) endInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (!speech.supported) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold mb-2">Browser not supported</h1>
        <p className="text-slate-500 max-w-sm">
          Voice interviews need the Web Speech API. Please use Google Chrome on
          desktop.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 text-sm text-slate-600 underline"
        >
          Back to dashboard
        </button>
      </Centered>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-8 w-8 shrink-0 rounded-full bg-indigo-600 text-white grid place-items-center text-sm font-semibold">
              A
            </span>
            <h1 className="font-semibold truncate">{label} interview</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-sm font-mono tabular-nums rounded-full px-2.5 py-1 ${
                secondsLeft <= 60
                  ? "bg-red-50 text-red-600"
                  : "bg-slate-100 text-slate-600"
              }`}
              title="Time remaining"
            >
              {formatTime(secondsLeft)}
            </span>
            <button
              onClick={endInterview}
              disabled={ending}
              className="text-sm text-slate-500 rounded-lg px-3 py-1.5 font-medium hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition"
            >
              {ending ? "Ending…" : "End"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
        {/* Live transcript */}
        <div className="flex-1 space-y-4 overflow-y-auto mb-5 pr-1">
          {transcript.map((line, i) => (
            <Bubble key={i} role={line.role} text={line.content} />
          ))}
          {speech.listening && speech.interim && (
            <Bubble role="candidate" text={speech.interim} dim />
          )}
          <div ref={transcriptEndRef} />
        </div>

        {(error || speech.error) && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
            {error || speech.error}
          </p>
        )}

        {/* Completion card, or the status + mic control */}
        {phase === "closed" ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center gap-3 text-center shadow-sm">
            <span className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h3 className="text-lg font-semibold">That's a wrap</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              The interview is complete. Generate your feedback report from the
              full conversation.
            </p>
            <button
              onClick={endInterview}
              disabled={ending}
              className="mt-2 bg-indigo-600 text-white rounded-xl px-6 py-3 font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
            >
              {ending ? "Generating feedback…" : "Get your feedback"}
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl px-6 py-8 flex flex-col items-center gap-5 shadow-sm">
            <StatusPill phase={phase} />
            <MicButton phase={phase} onClick={handleMicClick} />
            <p className="text-sm text-slate-500 h-5 text-center">
              {helperText(phase)}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function formatTime(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function helperText(phase) {
  switch (phase) {
    case "connecting":
      return "Connecting…";
    case "speaking":
      return "The interviewer is speaking… (or click the mic to jump in)";
    case "ready":
      return "Click the mic and answer out loud.";
    case "listening":
      return "Listening… click again when you're done.";
    case "thinking":
      return "Thinking…";
    default:
      return "";
  }
}

function StatusPill({ phase }) {
  const map = {
    connecting: ["Connecting", "bg-slate-100 text-slate-600"],
    speaking: ["Alex is speaking", "bg-indigo-50 text-indigo-700"],
    ready: ["Your turn", "bg-emerald-50 text-emerald-700"],
    listening: ["Listening to you", "bg-rose-50 text-rose-700"],
    thinking: ["Thinking", "bg-amber-50 text-amber-700"],
    error: ["Error", "bg-red-50 text-red-700"],
  };
  const [label, cls] = map[phase] || map.connecting;
  const dot =
    phase === "speaking"
      ? "bg-indigo-500"
      : phase === "ready"
      ? "bg-emerald-500"
      : phase === "listening"
      ? "bg-rose-500"
      : phase === "thinking"
      ? "bg-amber-500"
      : "bg-slate-400";
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1.5 ${cls}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dot} ${
          ["speaking", "listening", "thinking"].includes(phase)
            ? "animate-pulse"
            : ""
        }`}
      />
      {label}
    </span>
  );
}

function MicButton({ phase, onClick }) {
  // Enabled whenever it's (or could become) the candidate's turn — including
  // during "speaking" so the candidate can interrupt (barge-in).
  const disabled = !["ready", "listening", "speaking"].includes(phase);
  const isListening = phase === "listening";
  const isSpeaking = phase === "speaking";
  const active = isListening || isSpeaking;

  // Speaking = indigo (Alex), listening = rose (you), idle/ready = indigo core.
  const ringColor = isListening ? "bg-rose-400" : "bg-indigo-400";
  const core = isListening
    ? "from-rose-500 to-rose-600"
    : disabled
    ? "from-slate-300 to-slate-400"
    : "from-indigo-500 to-indigo-600";

  return (
    <div className="relative w-32 h-32 grid place-items-center">
      {/* Animated ripple rings when Alex is speaking or you're being heard. */}
      {active && (
        <>
          <span
            className={`absolute h-24 w-24 rounded-full opacity-30 ${ringColor} animate-ping`}
          />
          <span
            className={`absolute h-28 w-28 rounded-full opacity-20 ${ringColor} animate-ping [animation-delay:0.5s]`}
          />
        </>
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative z-10 w-24 h-24 rounded-full grid place-items-center text-white shadow-lg bg-gradient-to-br transition-transform duration-200 ${core} ${
          disabled ? "cursor-not-allowed" : "hover:scale-105 active:scale-95"
        }`}
        aria-label={isListening ? "Stop and submit" : "Start speaking"}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
    </div>
  );
}

function Bubble({ role, text, dim }) {
  const isAI = role === "interviewer";
  return (
    <div className={`flex items-end gap-2 ${isAI ? "justify-start" : "justify-end"}`}>
      {isAI && (
        <span className="h-7 w-7 shrink-0 rounded-full bg-indigo-600 text-white grid place-items-center text-xs font-semibold mb-0.5">
          A
        </span>
      )}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
          isAI
            ? "bg-white border border-slate-200 rounded-bl-md text-slate-800"
            : "bg-indigo-600 text-white rounded-br-md"
        } ${dim ? "opacity-60 italic" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center text-center p-4">
      {children}
    </div>
  );
}
