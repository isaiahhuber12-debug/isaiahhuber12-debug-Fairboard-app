# RallyHub

Community event coordination, volunteer task signups, role-based group chats, targeted alerts, and admin engagement analytics — rewritten from Android (Kotlin / Jetpack Compose) to a full-stack React + TypeScript + Express + Firebase web application.

## Features

- **Workspace Modes**:
  - **Guest Sandbox**: Instant local demo workspace (`CITY` / Fairboard Community) with browser-side state, task signups, event creation, role switching, and local persistence.
  - **Cloud Sync (Firebase)**: Google Sign-In (`signInWithPopup`) with Firestore real-time listeners across multi-group hubs, group creation, and 6-character invite code joining.
- **Role-Based Access Control (RBAC)**:
  - **Creator**: Full group ownership, admin promotion/demotion, group settings & code rotation, analytics, and announcements.
  - **Admin**: Group settings & code rotation, admin promotion (creator-protected demotion), broadcast/scheduled announcements, and member management.
  - **Organizer**: Event & volunteer task creation, deadline reminders, and organizer/channel updates.
  - **Participant**: Event browsing, task slot signups/withdrawals, and eligible group chat participation.
- **5-Tab Command Center**:
  - **Home (`DashboardScreen`)**: Hero summary, 3 metric stat tiles, fill-rate overview, upcoming events preview, recent announcements, and quick actions.
  - **Calendar (`CalendarScreen`)**: Month calendar strip, category filter (`All`, `Logistics`, `Operations`, `Community`), event composer, task capacity & signup controls, and deadline reminders.
  - **Chats (`ChatsScreen`)**: Role-gated channels (`All Members`, `Organizers & Admins`, `Admins Only`), channel composer, and real-time message feed.
  - **Alerts (`NotificationsScreen`)**: Scheduled/pending/posted announcements, targeted role/channel/event alerts, admin approval/publish actions, and browser Web Notification opt-in.
  - **Admin (`AdminPanelScreen`)**: Task coverage ring, engagement analytics, channel activity bars, member search & role filters, group settings/code rotation, and broadcast composer.
- **Server-Side Gemini AI Coordinator (`AiCoordinatorSheet`)**:
  - Streaming Q&A (`/api/ai/chat`) grounded in the live workspace snapshot via `@google/genai` on the Express backend (`GEMINI_API_KEY` never exposed to the client).
  - Structured JSON announcement & alert drafting (`/api/ai/draft`) that opens directly in the notification composer.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Express 5 (`server.ts`) on port `3000` with Vite dev middleware & Gemini API proxy routes
- **Database & Auth**: Firebase Authentication (Google) & Cloud Firestore (`firebase-applet-config.json`, `firestore.rules`)
- **AI**: `@google/genai` (`gemini-4-hydrogen`)

## Scripts

- `npm run dev` — Start Express + Vite dev server on `http://0.0.0.0:3000`
- `npm run build` — Build production client bundle to `dist/`
- `npm run start` — Serve production build & API routes on `http://0.0.0.0:3000`
- `npm run lint` — Run TypeScript typecheck (`tsc --noEmit`) and ESLint (including `@firebase/eslint-plugin-security-rules`)
