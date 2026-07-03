import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { typeLabel } from "../interviewTypes.js";

// Admin-only view of every candidate's post-interview experience feedback.
export default function AdminFeedback() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/feedback")
      .then(({ data }) => setRows(data.feedback))
      .catch((err) => {
        if (err.response?.status === 403) {
          setError("This page is for the admin only.");
        } else {
          setError(err.response?.data?.error || "Could not load feedback.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const avg =
    rows.length > 0
      ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1)
      : null;

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-semibold">Experience feedback</h1>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            Back to dashboard
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
            <p className="text-slate-500">No feedback submitted yet.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-6 mb-5 text-sm text-slate-600">
              <span>
                <b className="text-slate-900">{rows.length}</b> responses
              </span>
              <span>
                Avg rating <b className="text-slate-900">{avg}</b>/5
              </span>
            </div>
            <ul className="space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {r.candidateName}{" "}
                        <span className="text-slate-400 font-normal">
                          · {r.candidateEmail}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {typeLabel(r.interviewType)} ·{" "}
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Stars n={r.rating} />
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    {r.aiComment && (
                      <Line label="On Maya (AI)" text={r.aiComment} />
                    )}
                    {r.techIssues && (
                      <Line label="Tech issues" text={r.techIssues} warn />
                    )}
                    {r.comments && <Line label="Other" text={r.comments} />}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function Stars({ n }) {
  return (
    <span className="shrink-0 text-amber-500 tracking-tight" title={`${n}/5`}>
      {"★".repeat(n)}
      <span className="text-slate-300">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function Line({ label, text, warn }) {
  return (
    <p className="text-slate-600">
      <span
        className={`text-xs font-semibold uppercase tracking-wide mr-2 ${
          warn ? "text-amber-600" : "text-slate-400"
        }`}
      >
        {label}
      </span>
      {text}
    </p>
  );
}
