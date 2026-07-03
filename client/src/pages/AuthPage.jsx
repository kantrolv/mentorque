import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const EXPERIENCE_LEVELS = ["Entry", "Junior", "Mid", "Senior", "Lead"];

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    jobRole: "",
    experienceLevel: "Mid",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const isSignup = mode === "signup";

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = isSignup ? "/auth/signup" : "/auth/login";
      const payload = isSignup
        ? form
        : { email: form.email, password: form.password };
      const { data } = await api.post(path, payload);
      login(data);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-indigo-600 text-white grid place-items-center text-lg font-bold">
            M
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Voice Mock Interview
          </h1>
          <p className="text-slate-500 mt-1">
            Practice real interviews out loud.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex gap-2 mb-6 bg-slate-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                !isSignup ? "bg-white shadow-sm" : "text-slate-500"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                isSignup ? "bg-white shadow-sm" : "text-slate-500"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <Field label="Name">
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
            )}

            <Field label="Email">
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                minLength={isSignup ? 6 : undefined}
                required
              />
            </Field>

            {isSignup && (
              <>
                <Field label="Job role">
                  <input
                    className="input"
                    placeholder="e.g. Product Manager"
                    value={form.jobRole}
                    onChange={(e) => update("jobRole", e.target.value)}
                    required
                  />
                </Field>

                <Field label="Experience level">
                  <select
                    className="input"
                    value={form.experienceLevel}
                    onChange={(e) => update("experienceLevel", e.target.value)}
                  >
                    {EXPERIENCE_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-lg py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? "Please wait…" : isSignup ? "Create account" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
