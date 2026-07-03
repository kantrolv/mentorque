import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api.js";
import ExperienceForm from "../components/ExperienceForm.jsx";

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notReady, setNotReady] = useState(false);
  const [generating, setGenerating] = useState(false);

  function loadReport() {
    setLoading(true);
    return api
      .get(`/sessions/${id}/report`)
      .then(({ data }) => {
        setReport(data.report);
        setNotReady(false);
        setError("");
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          // Session ended but the report hasn't been generated yet.
          setNotReady(true);
        } else {
          setError(err.response?.data?.error || "Could not load report");
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function generateReport() {
    setGenerating(true);
    setError("");
    try {
      const { data } = await api.post(`/sessions/${id}/end`);
      setReport(data.report);
      setNotReady(false);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Couldn't generate the report just yet. Please try again in a moment."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-semibold">Interview feedback</h1>
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
        ) : report ? (
          <ReportBody report={report} />
        ) : notReady ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">Report not ready yet</h2>
            <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">
              This interview is finished, but its feedback report hasn't been
              generated — often because of a temporary rate limit. Generate it
              now from the recorded conversation.
            </p>
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mt-4">
                {error}
              </p>
            )}
            <button
              onClick={generateReport}
              disabled={generating}
              className="mt-5 bg-indigo-600 text-white rounded-xl px-6 py-3 font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
            >
              {generating ? "Generating…" : "Generate report"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}

        {/* Post-interview experience survey (once the session exists). */}
        {(report || notReady) && (
          <div className="mt-5">
            <ExperienceForm sessionId={id} />
          </div>
        )}
      </main>
    </div>
  );
}

function ReportBody({ report }) {
  return (
    <div className="space-y-5">
      {/* Overall hero */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-6">
          <ScoreCircle score={report.overallScore} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Overall impression
            </p>
            <p className="text-slate-700 mt-1.5 leading-relaxed">
              {report.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Competencies with score bars */}
      <Section title="Competencies">
        <div className="space-y-5">
          {report.competencies.map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-slate-800">{c.name}</span>
                <ScoreBadge score={c.score} />
              </div>
              <ScoreBar score={c.score} />
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {c.evidence}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Strengths" accent="emerald">
          <List items={report.strengths} tone="emerald" />
        </Section>
        <Section title="Areas to improve" accent="amber">
          <List items={report.improvements} tone="amber" />
        </Section>
      </div>

      <Section title="Communication">
        <p className="text-sm text-slate-600 leading-relaxed">
          {report.communicationNotes}
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children, accent }) {
  const dot =
    accent === "emerald"
      ? "bg-emerald-500"
      : accent === "amber"
      ? "bg-amber-500"
      : "bg-indigo-500";
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function List({ items, tone }) {
  const dot = tone === "emerald" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function scoreColor(score) {
  if (score >= 8) return "text-emerald-600";
  if (score >= 5) return "text-amber-600";
  return "text-red-600";
}

function scoreBarBg(score) {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-red-500";
}

function ScoreCircle({ score }) {
  const tint =
    score >= 8
      ? "bg-emerald-50 text-emerald-600"
      : score >= 5
      ? "bg-amber-50 text-amber-600"
      : "bg-red-50 text-red-600";
  return (
    <div
      className={`shrink-0 w-24 h-24 rounded-2xl grid place-items-center ${tint}`}
    >
      <div className="flex items-baseline font-bold">
        <span className="text-4xl leading-none">{score}</span>
        <span className="text-base text-slate-400">/10</span>
      </div>
    </div>
  );
}

function ScoreBar({ score }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${scoreBarBg(score)} transition-all`}
        style={{ width: `${score * 10}%` }}
      />
    </div>
  );
}

function ScoreBadge({ score }) {
  return (
    <span className={`text-sm font-semibold ${scoreColor(score)}`}>
      {score}/10
    </span>
  );
}
