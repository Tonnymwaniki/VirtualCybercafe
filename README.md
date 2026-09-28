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

## Project layout

- `src/app/`: screens (every file is a route)
  - `(tabs)/index.tsx`: Home, with the attendant chat box and quick services
  - `(tabs)/services.tsx`: all services
  - `(tabs)/locker.tsx`: the Digital Locker
  - `chat.tsx`: the attendant chat
  - `studio/`: Document Studio (passport photo, photos to PDF, shrink a photo)
  - `cv/`: guided CV and cover letter builder
  - `api/cv+api.ts`: server route that writes the CV
  - `api/chat+api.ts`: server route that talks to the AI
- `src/lib/`: chat helpers, the sample attendant and image/PDF helpers
- `src/components/`: shared UI pieces
- `src/constants/theme.ts`: colours and spacing
- `src/data/`: sample data used until the backend exists
- `assets/`: icons and splash images
