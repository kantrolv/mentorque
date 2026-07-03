import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { typeLabel } from "../interviewTypes.js";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/sessions")
      .then(({ data }) => setSessions(data.sessions))
      .catch(() => setError("Could not load sessions"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-indigo-600 text-white grid place-items-center text-sm font-bold">
              A
            </span>
            <div>
              <h1 className="font-semibold leading-tight">Mock Interview</h1>
              <p className="text-xs text-slate-500">
                {user?.name} · {user?.jobRole}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Your interviews</h2>
          <button
            onClick={() => navigate("/new")}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
          >
            Start new interview
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <p className="text-slate-500">
              No interviews yet. Start your first mock interview.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => navigate(`/report/${s.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 px-5 py-4 hover:border-indigo-400 hover:shadow-sm transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {typeLabel(s.interviewType)} interview
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(s.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {s.status === "completed" ? (
                      <span className="inline-flex items-baseline gap-1 rounded-full bg-slate-100 px-3 py-1">
                        <span className="text-base font-bold text-slate-800">
                          {s.overallScore ?? "—"}
                        </span>
                        <span className="text-xs text-slate-400">/10</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">
                        In progress
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
