import { useEffect, useState } from "react";
import api from "../api.js";

// Post-interview survey: the candidate rates their EXPERIENCE (the AI, tech
// issues, etc.). Submitted feedback is reviewable only by the admin.
export default function ExperienceForm({ sessionId }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [aiComment, setAiComment] = useState("");
  const [techIssues, setTechIssues] = useState("");
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("loading"); // loading | form | saving | done
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/sessions/${sessionId}/experience`)
      .then(({ data }) => setStatus(data.submitted ? "done" : "form"))
      .catch(() => setStatus("form"));
  }, [sessionId]);

  async function submit(e) {
    e.preventDefault();
    if (!rating) {
      setError("Please pick a star rating for your experience.");
      return;
    }
    setError("");
    setStatus("saving");
    try {
      await api.post(`/sessions/${sessionId}/experience`, {
        rating,
        aiComment,
        techIssues,
        comments,
      });
      setStatus("done");
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't submit — please try again.");
      setStatus("form");
    }
  }

  if (status === "loading") return null;

  if (status === "done") {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm text-center">
        <p className="font-semibold">Thanks for your feedback! 🙏</p>
        <p className="text-sm text-slate-500 mt-1">
          It helps us make the interview experience better.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5"
    >
      <div>
        <h3 className="font-semibold">How was your experience?</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Quick feedback about the interview — this only goes to the team.
        </p>
      </div>

      {/* Star rating */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          Overall experience
        </label>
        <div className="flex gap-1 mt-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="p-0.5"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill={(hover || rating) >= n ? "#f59e0b" : "none"}
                stroke={(hover || rating) >= n ? "#f59e0b" : "#cbd5e1"}
                strokeWidth="1.8"
                strokeLinejoin="round"
              >
                <path d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.8-4.6 6.6-.9z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <Field label="How was Maya, the AI interviewer?">
        <textarea
          className="input min-h-[70px]"
          value={aiComment}
          onChange={(e) => setAiComment(e.target.value)}
          placeholder="Did she feel natural? Were the questions relevant?"
        />
      </Field>

      <Field label="Any technical issues? (mic, audio, delays, cut-offs…)">
        <textarea
          className="input min-h-[70px]"
          value={techIssues}
          onChange={(e) => setTechIssues(e.target.value)}
          placeholder="Tell us what went wrong, if anything."
        />
      </Field>

      <Field label="Anything else? (optional)">
        <textarea
          className="input min-h-[60px]"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </Field>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="bg-indigo-600 text-white rounded-xl px-6 py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
      >
        {status === "saving" ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
