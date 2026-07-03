# Mentorque — AI Voice Mock Interview Platform

A full-stack, **voice-only** AI mock interviewer. A candidate signs up, picks an
interview type, and has a **real, dynamic spoken conversation** with an AI
interviewer named **Maya** — she listens to each answer, asks natural
follow-ups, references what you actually said, probes weak answers, and closes
the interview gracefully. At the end, a **written feedback report** is generated
from the full transcript, and the candidate can leave **experience feedback**
that only the admin can review.

- 🎙️ **Live demo:** https://mentorque-one.vercel.app (Chrome on desktop)
- 💻 **Repo:** https://github.com/kantrolv/mentorque

---

## Table of contents

1. [What it does](#what-it-does)
2. [Key features](#key-features)
3. [Interview types](#interview-types)
4. [How it works](#how-it-works)
5. [Tech stack](#tech-stack)
6. [Project structure](#project-structure)
7. [Data model](#data-model)
8. [API reference](#api-reference)
9. [Local setup](#local-setup)
10. [Environment variables](#environment-variables)
11. [Deployment](#deployment)
12. [Admin feedback page](#admin-feedback-page)
13. [Notes & constraints](#notes--constraints)

---

## What it does

- **Voice only.** The candidate speaks (push-to-talk); Maya speaks back. There
  is no text-chat interview mode.
- **No question bank.** Every interviewer turn is generated live from the
  **entire conversation so far** — nothing is scripted.
- **One interview, done well — five domains.** Behavioral/HR plus four technical
  tracks, all sharing the same conversation engine; only the domain focus of the
  system prompt changes.
- **Grounded feedback.** The end-of-interview report bases every score on
  specific things the candidate said, and never penalizes them for topics that
  were never asked.
- **Runs on free tiers.** Google Gemini for the LLM, the browser's Web Speech
  API for voice — no paid speech/AI services.

---

## Key features

| Area | Details |
| --- | --- |
| **Voice loop** | Push-to-talk mic for reliable turn-taking; long, multi-sentence answers are captured in full; Maya's replies are spoken with a warm female voice; barge-in supported (click the mic while she's talking). |
| **Dynamic interviewer** | Full history sent to Gemini every turn; references the candidate's exact words; probes vague answers; acknowledges strong ones; friendly and domain-proficient. |
| **Interview framing** | After introducing herself, Maya states the interview type and sets expectations ("take your time, there's no rush") without promising a fixed number of questions. |
| **Natural closing** | Wrap-up nudge as the interview runs long, plus a hard turn cap and a 30-minute countdown that ends the session automatically. |
| **Feedback report** | One structured Gemini call over the transcript, validated with **zod**; overall score, per-competency scores with quoted evidence and justification, strengths, improvements, and communication notes. |
| **Robust completion** | Ending always marks the session complete — even if report generation is rate-limited — with a one-click "Generate report" retry, so interviews never get stuck "In progress". |
| **Experience survey** | After an interview the candidate rates the experience (stars), comments on the AI, and reports any technical issues. |
| **Admin review** | An owner-only `/admin` page lists every candidate's experience feedback, gated by `ADMIN_EMAIL`. |
| **Auth** | Simple email + password with bcrypt hashing and JWT. |

---

## Interview types

Selected on a picker before the interview starts and stored on the session.

| Id | Label | Focus |
| --- | --- | --- |
| `hr` | HR / Culture Fit | Motivation, values, teamwork, conflict, handling failure |
| `sde` | SDE (Software Engineer) | CS fundamentals, data structures, algorithms, problem-solving |
| `ai` | AI / ML Engineer | ML fundamentals, model evaluation, LLM engineering, trade-offs |
| `fullstack` | Full-Stack Developer | APIs, databases, auth, deployment, end-to-end architecture |
| `frontend` | Frontend Developer | JavaScript, React, CSS, browser behavior, performance, UX |

---

## How it works

**The conversation engine.** Each interview is a `Session` with a list of
`Message`s. On every candidate turn the backend saves the answer, loads the full
message history, sends it to Gemini with a domain-specific system prompt, saves
the reply, and returns it. There is no hardcoded question list — Maya decides
what to ask next from the conversation itself.

**Voice.** The frontend uses the browser **Web Speech API**:
`SpeechRecognition` captures the candidate's speech (accumulating every final
result so long answers aren't truncated, and only finalizing when the user
releases push-to-talk), and `SpeechSynthesis` speaks Maya's replies with a
selected female voice.

**Closing & timing.** As the interview runs long, the backend nudges Maya to
wrap up and then to close; a heuristic detects the closing line so the UI can
move the candidate to feedback. A 30-minute on-screen countdown ends the session
via the same flow if time runs out.

**Report.** On end, the transcript is sent to Gemini for a JSON report that is
validated with zod (retried once on failure). If generation is temporarily
rate-limited, the session is still completed and the report can be regenerated
from the report screen.

**Experience feedback.** The report screen also shows a short survey; submissions
are stored per session and surfaced only on the admin page.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | **React + Vite**, **React Router**, **Tailwind CSS**, **axios** |
| Voice | Browser **Web Speech API** (`SpeechRecognition` + `SpeechSynthesis`) |
| LLM | **Google Gemini** via **`@google/genai`** (default `gemini-2.5-flash-lite`) |
| Backend | **Node + Express**, **jsonwebtoken**, **bcryptjs**, **cors**, **dotenv**, **zod** |
| Database | **PostgreSQL** (Supabase or Neon) via **Prisma** |
| Hosting | **Vercel** (frontend) · **Render** (backend) · **Supabase/Neon** (DB) |

---

## Project structure

```
mentorque/
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── api.js              # axios instance + auth token
│   │   ├── App.jsx            # routes
│   │   ├── main.jsx
│   │   ├── index.css          # Tailwind
│   │   ├── interviewTypes.js  # the 5 types + labels
│   │   ├── context/AuthContext.jsx
│   │   ├── hooks/useSpeech.js # Web Speech (recognition + synthesis)
│   │   ├── components/ExperienceForm.jsx
│   │   └── pages/
│   │       ├── AuthPage.jsx        # signup / login
│   │       ├── Dashboard.jsx       # past sessions + Admin link
│   │       ├── NewInterview.jsx    # type picker
│   │       ├── Interview.jsx       # the voice interview screen
│   │       ├── ReportPage.jsx      # feedback report + experience survey
│   │       └── AdminFeedback.jsx   # admin-only feedback review
│   ├── vercel.json            # SPA rewrite for deep links
│   └── vite.config.js, tailwind.config.js, postcss.config.js
├── server/                     # Express backend + Prisma
│   ├── src/
│   │   ├── index.js           # app, CORS, route mounting, /health
│   │   ├── prisma.js          # shared Prisma client
│   │   ├── auth.js            # JWT sign/verify, requireAuth, requireAdmin
│   │   ├── gemini.js          # Gemini helper w/ retry & backoff
│   │   ├── prompts.js         # system prompts, framing, report prompt
│   │   ├── reportSchema.js    # zod schema for the report
│   │   └── routes/
│   │       ├── authRoutes.js
│   │       ├── sessionRoutes.js
│   │       └── adminRoutes.js
│   └── prisma/schema.prisma, prisma/migrations/
├── render.yaml                 # Render blueprint for the backend
└── README.md
```

---

## Data model

Prisma models (`server/prisma/schema.prisma`):

- **User** — `id`, `email` (unique), `passwordHash`, `name`, `jobRole`,
  `experienceLevel`, `createdAt`
- **Session** — `id`, `userId`, `interviewType`, `status` (`active` /
  `completed`), `startedAt`, `endedAt`
- **Message** — `id`, `sessionId`, `role` (`interviewer` / `candidate`),
  `content`, `createdAt`
- **Report** — `id`, `sessionId` (unique), `data` (JSON), `createdAt`
- **ExperienceFeedback** — `id`, `sessionId` (unique), `rating` (1–5),
  `aiComment`, `techIssues`, `comments`, `createdAt`

---

## API reference

All `/sessions` and `/admin` routes require a `Authorization: Bearer <JWT>` header.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/signup` | – | Create user, return JWT + user (incl. `isAdmin`) |
| POST | `/auth/login` | – | Verify password, return JWT + user |
| POST | `/sessions` | ✓ | Start a session (`{ interviewType }`), return opening line |
| POST | `/sessions/:id/message` | ✓ | Send a spoken answer, return `{ reply, done }` |
| POST | `/sessions/:id/end` | ✓ | Complete the session, generate + return the report |
| GET | `/sessions` | ✓ | List the user's sessions (with score) |
| GET | `/sessions/:id/report` | ✓ | Fetch a session's report |
| GET | `/sessions/:id/experience` | ✓ | Whether experience feedback was submitted |
| POST | `/sessions/:id/experience` | ✓ | Submit experience feedback (`rating`, `aiComment`, `techIssues`, `comments`) |
| GET | `/admin/feedback` | ✓ admin | List all experience feedback (admin only) |
| GET | `/health` | – | Health check |

---

## Local setup

### Prerequisites

1. **PostgreSQL** — a free [Supabase](https://supabase.com) or
   [Neon](https://neon.tech) project. Copy its **pooled** and **direct**
   connection strings.
2. **Gemini API key** — free at https://aistudio.google.com/app/apikey. Newer
   keys start with `AQ.` and require the `@google/genai` SDK (already used here).
3. **Google Chrome** on desktop — the Web Speech API works best there.

### Steps

```bash
# 1. Backend deps
cd server && npm install

# 2. Configure secrets — copy the example and fill it in
cp .env.example .env    # set DATABASE_URL, DIRECT_URL, GEMINI_API_KEY, JWT_SECRET, ADMIN_EMAIL

# 3. Create the database tables
npx prisma migrate deploy

# 4. Frontend deps + config (from repo root)
cd ../client && npm install && cp .env.example .env

# 5. Run both (two terminals):
#    A:  cd server && npm run dev
#    B:  cd client && npm run dev
```

Open **http://localhost:5173 in Chrome**, sign up, pick an interview type, allow
the microphone, and start talking. The backend runs on http://localhost:4000.

---

## Environment variables

**`server/.env`**

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres connection (Supabase port `6543` / Neon pooled) |
| `DIRECT_URL` | Direct Postgres connection (port `5432`) — used for migrations |
| `JWT_SECRET` | Long random string used to sign JWTs |
| `GEMINI_API_KEY` | Google Gemini API key (free tier) |
| `GEMINI_MODEL` | Optional model override (default `gemini-2.5-flash-lite`) |
| `ADMIN_EMAIL` | The email you log into the app with — the only account that can open `/admin` |
| `CLIENT_ORIGIN` | Allowed CORS origin(s), comma-separated (the frontend URL) |
| `PORT` | Server port (Render sets this automatically) |

> **URL-encode DB passwords.** If a password contains `@ : / ? # &`,
> percent-encode it (`@` → `%40`) or copy the pre-encoded string from your DB
> dashboard.

**`client/.env`**

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Backend base URL (e.g. `http://localhost:4000`, or your Render URL) |

---

## Deployment

All three run on free tiers. HTTPS is required for the Web Speech API — Vercel
and Render both provide it. Use Chrome.

**Database — Supabase / Neon**
Create a project; use the pooled string for `DATABASE_URL` and the direct string
for `DIRECT_URL`.

**Backend — Render** (blueprint included: [`render.yaml`](render.yaml))
_New + → Blueprint_, point it at this repo, and set `DATABASE_URL`,
`DIRECT_URL`, `GEMINI_API_KEY`, `ADMIN_EMAIL`, and `CLIENT_ORIGIN` (your Vercel
URL). It uses:
- Build: `npm install && npx prisma migrate deploy`
- Start: `npm start`

**Frontend — Vercel**
Import the repo, set **root directory to `client`** (framework auto-detects as
Vite), and add env var `VITE_API_URL` = your Render backend URL.
[`client/vercel.json`](client/vercel.json) provides the SPA rewrite so deep
links (e.g. `/report/:id`, `/admin`) don't 404 on refresh.

After deploying, set the backend's `CLIENT_ORIGIN` to your exact Vercel domain
so CORS allows it.

---

## Admin feedback page

The post-interview survey is stored per session; the owner reviews it at
`/admin`.

- Set **`ADMIN_EMAIL`** (server env) to the email you log into the app with.
  Only that account can open `/admin` — the route is enforced server-side (403
  otherwise), and the **Admin** link appears in the dashboard header only for
  that account.
- Already logged in? **Log out and back in** once so your session picks up the
  `isAdmin` flag.

---

## Notes & constraints

- **Free-tier Gemini quota.** Rapid testing can hit per-minute/daily `429`s. The
  app degrades gracefully (clear message, mic re-enables, report retry). If a
  model's quota runs out, set `GEMINI_MODEL` to another (e.g. `gemini-2.5-flash`)
  or use a fresh key.
- **Browser support.** The Web Speech API works best in Chrome on desktop, and
  needs HTTPS in production (localhost is treated as secure for local dev).
- **Interview length.** Wrap-up/close turn caps live in `server/src/prompts.js`
  (`WRAP_UP_AFTER`, `CLOSE_AFTER`); the 30-minute timer is in
  `client/src/pages/Interview.jsx`.

---

### Scripts

**server**: `npm run dev` (watch) · `npm start` · `npm run migrate:deploy`
**client**: `npm run dev` · `npm run build` · `npm run preview`
