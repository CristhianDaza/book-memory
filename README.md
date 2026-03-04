# bookMemory

Web app to manage a personal reading library, track reading sessions, monitor page progress, and visualize reading stats.

## Tech Stack

- Vue 3 + Vite + TypeScript
- Pinia (state management)
- Vue Router
- Vue I18n (EN/ES)
- Tailwind CSS
- Firebase (Auth + Firestore)
- PWA via `vite-plugin-pwa`

## Current Features

- Authentication:
  - Email/password login and registration
  - Google Sign-In
  - Route protection for authenticated areas
- Library:
  - Search books (Google Books API)
  - Add books to personal library
  - Mark/unmark favorites
  - Edit metadata (status, total pages, current page)
  - Remove books (with session cleanup)
- Reading sessions:
  - Timer-based sessions
  - Save sessions with start/end pages and duration
  - Edit/delete existing sessions
- Stats:
  - Totals (sessions, pages, minutes)
  - Current and best streak
  - Week/month counters
  - Activity chart by sessions/pages/minutes
- App UX:
  - Global notifications
  - Confirm/prompt modals
  - Basic PWA setup (manifest + service worker generation)

## Requirements

- Node.js 20+ (recommended: Node 22)
- npm
- Firebase project with Auth + Firestore enabled
- (Optional) Google Books API key for higher quota

## Environment Variables

Copy `.env.example` to `.env` and fill values:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_BOOKS_API_KEY=
```

## Local Development

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: type-check + production build
- `npm run preview`: preview production build
- `npm run typecheck`: TypeScript checks
- `npm run lint`: ESLint in strict mode (`--max-warnings=0`)
- `npm run lint:fix`: auto-fix lint issues where possible

## CI (GitHub Actions)

Lint workflow runs automatically on:

- Push to `main`
- Push to `develop`
- Pull requests targeting `main` or `develop`

Workflow file: `.github/workflows/lint.yml`
