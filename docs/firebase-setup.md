# Firebase Setup and Deploy

## 1. Create Firebase project

1. Create a Firebase project in the Firebase Console.
2. Add a Web App.
3. Enable Authentication providers:
   - Email/Password
   - Google
4. Create Firestore database (Production or Test mode as needed).

## 2. Configure environment variables

Copy `.env.example` to `.env` and fill all Firebase variables:

```bash
cp .env.example .env
```

Required keys:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional:

- `VITE_GOOGLE_BOOKS_API_KEY` (recommended to improve API quota)

## 3. Apply Firestore rules and indexes

This repository includes:

- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

Install Firebase CLI and deploy:

```bash
npm i -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

## 4. Deploy hosting

Build and deploy SPA hosting:

```bash
npm run build
firebase deploy --only hosting
```

## 5. Notes

- Firestore access is user-scoped under `users/{uid}/library` and `users/{uid}/sessions`.
- If you change query patterns, you may need to update `firestore.indexes.json`.
