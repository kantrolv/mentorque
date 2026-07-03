# AI Voice Mock Interview Platform

A full-stack, **voice-only** AI mock interviewer. A candidate signs up, picks an
interview type, and has a **real, dynamic spoken conversation** with an AI
interviewer ("Alex") that listens to each answer, asks natural follow-ups,
probes weak answers, and closes the interview naturally. At the end, a written
feedback report is generated from the full transcript.

- **Voice only** — the candidate speaks (push-to-talk); the AI speaks back.
- **No question bank** — every interviewer turn is generated from the full
  conversation so far.
- **5 interview types** — HR / Culture Fit, SDE, AI/ML, Full-Stack, Frontend.
  All reuse the same conversation engine; only the domain focus of the system
  prompt changes.

## Tech stack

| Layer     | Tech                                                                 |
| --------- | ------------------------------------------------------------------- |
| Frontend  | React + Vite, React Router, Tailwind CSS, axios                     |
| Voice     | Browser **Web Speech API** (SpeechRecognition + SpeechSynthesis)    |
| LLM       | **Google Gemini** via `@google/genai` (`gemini-2.5-flash-lite`)     |
| Backend   | Node + Express, jsonwebtoken, bcryptjs, cors, dotenv, **zod**       |
| Database  | PostgreSQL (Supabase or Neon) via **Prisma**                        |

```
/client   React + Vite frontend
/server   Express backend + Prisma
```

## Prerequisites

1. **PostgreSQL** — a free [Supabase](https://supabase.com) or
   [Neon](https://neon.tech) project. Copy its pooled and direct connection
   strings.
2. **Gemini API key** — free at https://aistudio.google.com/app/apikey.
   Newer keys start with `AQ.` and require the `@google/genai` SDK (already used
   here).
3. **Google Chrome** on desktop — the Web Speech API works best there and needs
   HTTPS in production (localhost is treated as secure).

## Local setup (5 commands)

```bash
# 1. Install backend deps
cd server && npm install

# 2. Configure secrets — copy the example and fill in DB + Gemini values
cp .env.example .env        # then edit DATABASE_URL, DIRECT_URL, GEMINI_API_KEY, JWT_SECRET

# 3. Create the database tables
npx prisma migrate deploy

# 4. Install frontend deps + config
cd ../client && npm install && cp .env.example .env

# 5. Run both (two terminals):
#    A:  cd server && npm run dev
#    B:  cd client && npm run dev
```

Open **http://localhost:5173 in Chrome**, sign up, pick an interview type, allow
the microphone, and start talking. Backend runs on http://localhost:4000.

## Environment variables

**server/.env**

| var              | description                                                    |
| ---------------- | -------------------------------------------------------------- |
| `DATABASE_URL`   | Pooled Postgres connection (Supabase port 6543 / Neon pooled)  |
| `DIRECT_URL`     | Direct Postgres connection (port 5432) — used for migrations   |
| `JWT_SECRET`     | Long random string used to sign JWTs                           |
| `GEMINI_API_KEY` | Google Gemini API key (free tier)                              |
| `GEMINI_MODEL`   | Optional model override (default `gemini-2.5-flash-lite`)      |
| `CLIENT_ORIGIN`  | Allowed CORS origin(s), comma-separated (the frontend URL)     |
| `PORT`           | Server port (Render sets this automatically)                   |

> **URL-encode DB passwords.** If your password contains `@ : / ? # &`,
> percent-encode it (`@` → `%40`) or copy the pre-encoded string from your DB
> dashboard.

**client/.env**

| var            | description                                       |
| -------------- | ------------------------------------------------- |
| `VITE_API_URL` | Backend base URL (e.g. `http://localhost:4000`)   |

## API

| method | route                     | auth | purpose                                     |
| ------ | ------------------------- | ---- | ------------------------------------------- |
| POST   | `/auth/signup`            | –    | create user, return JWT                     |
| POST   | `/auth/login`             | –    | verify password, return JWT                 |
| POST   | `/sessions`               | ✓    | start a session (body `{ interviewType }`), return opening line |
| POST   | `/sessions/:id/message`   | ✓    | send spoken answer, get `{ reply, done }`   |
| POST   | `/sessions/:id/end`       | ✓    | complete session, generate + return report  |
| GET    | `/sessions`               | ✓    | list the user's sessions                    |
| GET    | `/sessions/:id/report`    | ✓    | fetch a session's report                    |
| GET    | `/health`                 | –    | health check                                |

The Gemini helper retries with backoff on 429s and returns a clear message when
the free-tier quota is exhausted. If one model's daily quota runs out, set
`GEMINI_MODEL` to another (e.g. `gemini-2.5-flash`, `gemini-2.0-flash`).

## Deployment (all free tiers)

**Database — Supabase / Neon:** create a project; use the pooled string for
`DATABASE_URL` and the direct string for `DIRECT_URL`.

**Backend — Render:** the repo includes [`render.yaml`](render.yaml). In Render:
_New + → Blueprint_, point it at this repo, and fill in `DATABASE_URL`,
`DIRECT_URL`, `GEMINI_API_KEY`, and `CLIENT_ORIGIN` (your Vercel URL). It uses:
- Build: `npm install && npx prisma migrate deploy`
- Start: `npm start`

Or configure a Web Service manually with root directory `server` and those same
commands.

**Frontend — Vercel:** import the repo, set **root directory to `client`**
(framework auto-detects as Vite). Add env var `VITE_API_URL` = your Render URL.
[`client/vercel.json`](client/vercel.json) provides the SPA rewrite so deep
links (e.g. `/report/:id`) don't 404 on refresh.

**After deploy:** set the backend's `CLIENT_ORIGIN` to your exact Vercel domain
so CORS allows it. Web Speech API requires HTTPS — Vercel and Render both
provide it. Use Chrome.

## Data model (Prisma)

- **User** — id, email (unique), passwordHash, name, jobRole, experienceLevel
- **Session** — id, userId, interviewType, status (`active`/`completed`), timestamps
- **Message** — id, sessionId, role (`interviewer`/`candidate`), content
- **Report** — id, sessionId (unique), data (JSON)
