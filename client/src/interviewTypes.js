// Interview types shown on the selection screen. `id` is stored on the Session
// and drives the backend system prompt.
export const INTERVIEW_TYPES = [
  {
    id: "hr",
    label: "HR / Culture Fit",
    blurb: "Motivation, values, teamwork, and how you handle conflict and failure.",
    abbr: "HR",
  },
  {
    id: "sde",
    label: "SDE (Software Engineer)",
    blurb: "CS fundamentals, data structures, problem-solving, and system thinking.",
    abbr: "SDE",
  },
  {
    id: "ai",
    label: "AI / ML Engineer",
    blurb: "ML fundamentals, model evaluation, LLM engineering, and trade-offs.",
    abbr: "AI",
  },
  {
    id: "fullstack",
    label: "Full-Stack Developer",
    blurb: "End-to-end web: APIs, databases, auth, deployment, and architecture.",
    abbr: "FS",
  },
  {
    id: "frontend",
    label: "Frontend Developer",
    blurb: "React, JavaScript, CSS, performance, accessibility, and UX judgment.",
    abbr: "FE",
  },
];

// Map an id (including legacy "behavioral") to a display label.
export function typeLabel(id) {
  return INTERVIEW_TYPES.find((t) => t.id === id)?.label || "Behavioral";
}
