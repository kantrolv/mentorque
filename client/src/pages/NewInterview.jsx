import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { INTERVIEW_TYPES } from "../interviewTypes.js";

export default function NewInterview() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(null); // the id being started
  const [error, setError] = useState("");

  async function pick(typeId) {
    if (starting) return;
    setStarting(typeId);
    setError("");
    try {
      const { data } = await api.post("/sessions", { interviewType: typeId });
      navigate(`/interview/${data.sessionId}`, {
        state: { opening: data.reply, type: typeId },
      });
    } catch (err) {
      setError(err.response?.data?.error || "Could not start interview");
      setStarting(null);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-semibold">Choose an interview</h1>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            Cancel
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold tracking-tight">
          What would you like to practice?
        </h2>
        <p className="text-slate-500 mt-1 mb-6">
          Each one is a live, ~30-minute voice conversation with Alex.
        </p>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
            {error}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {INTERVIEW_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              disabled={!!starting}
              className={`group text-left bg-white rounded-2xl border p-5 transition disabled:opacity-60 hover:-translate-y-0.5 hover:shadow-md ${
                starting === t.id
                  ? "border-indigo-500 ring-2 ring-indigo-100"
                  : "border-slate-200 hover:border-indigo-400"
              }`}
            >
              <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-sm grid place-items-center mb-3 group-hover:bg-indigo-100 transition">
                {t.abbr}
              </div>
              <p className="font-semibold">{t.label}</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                {t.blurb}
              </p>
              {starting === t.id && (
                <p className="text-xs font-medium text-indigo-600 mt-3">
                  Starting…
                </p>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
