# Virtual Cybercafe

Virtual Cybercafe is a mobile app for Android and iOS. It is an AI-powered cybercafe in your pocket: tell an attendant what you need, and it helps with government services, CVs, documents, printing and payments. The same code runs as an Android app, an iOS app and a website.

## Stack

- [Expo](https://expo.dev) (React Native)
- TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) for screens and the bottom menu

## Getting started

```bash
npm install
npm start        # starts the Expo dev server; scan the QR code with Expo Go
npm run android  # open on an Android device or emulator
npm run ios      # open on an iOS simulator (macOS only)
npm run web      # open in the browser
```

## AI attendant

The chat and the CV builder talk to small server routes (`src/app/api/`) that call Claude. Until a key is set, the chat answers with sample replies and CVs are written from a template.

To turn on the real AI, copy `.env.example` to `.env`, paste your key from https://console.anthropic.com, and restart `npm start`. The key stays on the server and never ships inside the app.

## Accounts and Digital Locker

Sign-in uses a phone number and an SMS code through [Supabase](https://supabase.com). Until Supabase is set up, the app runs in demo mode: any Kenyan number works with the code `123456`, and Locker files stay on the device for that session.

To connect Supabase:
1. Create a free project at supabase.com.
2. In **SQL Editor**, run `supabase/migrations/0001_locker.sql`. It creates the private `locker` bucket and rules so each person only sees their own files.
3. In **Authentication > Sign In / Providers**, turn on **Phone** and connect an SMS provider (for example Twilio).
4. Copy the Project URL and anon key from **Settings > API** into `.env` (see `.env.example`), then restart `npm start`.

## Project layout

- `src/app/`: screens (every file is a route)
  - `(tabs)/index.tsx`: Home, with the attendant chat box and quick services
  - `(tabs)/services.tsx`: all services
  - `(tabs)/locker.tsx`: the Digital Locker
  - `chat.tsx`: the attendant chat
  - `studio/`: Document Studio (passport photo, photos to PDF, shrink a photo)
  - `cv/`: guided CV and cover letter builder
  - `api/cv+api.ts`: server route that writes the CV
  - `sign-in.tsx`: phone number sign-in
  - `api/chat+api.ts`: server route that talks to the AI
- `src/lib/`: chat helpers, the sample attendant, image/PDF helpers, sign-in and Locker storage
- `supabase/migrations/`: database and storage rules
- `src/components/`: shared UI pieces
- `src/constants/theme.ts`: colours and spacing
- `src/data/`: sample data used until the backend exists
- `assets/`: icons and splash images
