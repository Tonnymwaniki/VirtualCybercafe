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

To turn on the real AI:
1. Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env` (key from https://console.anthropic.com). The key stays on the server and never ships inside the app.
2. Optional: the attendant uses Claude Haiku 4.5, the cheapest model. To switch, add `ANTHROPIC_MODEL=claude-sonnet-5-5` (or another model id).
3. Run `npm run check-keys` to confirm the key (and Supabase) work.
4. Restart with `npx expo start --clear`. The chat header stops saying "sample replies".

With the key, the attendant (`src/server/attendant-agent.ts`) works as an agent that can use tools:
- **Service guides** (`src/data/guides.ts`): passport, KRA PIN, good conduct, HELB, KUCCPS, driving licence, business name, job applications.
- **Open app tools**: passport photo, photos to PDF, shrink photo, CV builder, Locker, sign-in. These appear as buttons under its reply.
- **Check the Locker**: lists the signed-in person's saved files (read-only).
- **Write documents**: letters and forms-ready text the person downloads as a PDF.
- **Web search** (Kenya-focused) and **official links**.

It never submits forms or makes payments; the person does that. Tapping a service tile opens the chat with that service, so the same agent handles both.

## Government Services

The Government tile opens a workspace for nine tasks (`src/data/gov-tasks.ts`): Certificate of Good Conduct, KRA PIN, KRA tax returns, passport, replacing a lost ID, NTSA driving licence, birth certificate, SHA registration and business name registration. Each task has five steps:
1. **What you need**: Claude searches only the official sites for the current requirements and fee (`src/server/gov-agent.ts`). Results are reused for 3 days.
2. **Are you ready?**: a checklist that finds matching documents in the Locker, with upload and Document Studio shortcuts.
3. **Your details**: a photo of the National ID fills the form answers (Claude reads it; the photo isn't stored). Answers are checked for mistakes and each has a Copy button.
4. **Pay**: the fee and safe M-Pesa steps. The app never handles money or PINs.
5. **Track**: progress stages with dates.

"Ask about this task" opens the attendant focused on that task.

**My Details and the form helper.** People fill in their details once at Locker > My Details (`src/app/profile.tsx`, fields in `src/data/profile-fields.ts`). Every form reuses them: a form field with the same key as a My Details field is filled from it and saved back to it (Government tasks and the CV builder). The main attendant can read them with its `get_my_details` tool. On each task's details step, the **form helper** (`src/server/form-helper.ts`, `/api/form-helper`) sees the form, My Details, the Locker file names and the failed checks. It fills or fixes fields (highlighted with Undo), explains errors from eCitizen or iTax (typed or as a screenshot), opens app tools, and ticks requirements or progress. It uses only the user's own facts and never submits or pays. ID details and progress are saved in the signed-in user's private Supabase tables: run `supabase/migrations/0002_government.sql` in the SQL Editor once. Guests keep them on the device.

## Jobs & Career

The Jobs tile opens a workspace (`src/app/jobs/`) where each job is worked through in five steps: Advert, Match, CV & letter, Apply and Track.

- **Add a job** by pasting the advert, sharing a link, or photographing a newspaper advert. The jobs agent (`src/server/jobs-agent.ts`, `/api/jobs`) reads the title, employer, deadline, requirements, documents and how to apply. **Find jobs** searches trusted job sites only (Public Service Commission, BrighterMonday, MyJobMag, Fuzu).
- **Match** compares the advert with My Details (the new Career section: experience, education, skills) and the Locker, and lists matches, gaps and missing documents.
- **CV & letter** writes a CV, cover letter and application email for that advert from the saved career details, never adding anything the user didn't give.
- **Apply** builds one application pack PDF (letter, CV and ticked certificate photos from the Locker), shows the email draft for email applications, and puts the form helper beside job portal forms.
- **Track** keeps the status (Saved, Applied, Shortlisted, Interview, Offer) and deadline, with interview practice questions.
- Every advert gets a **scam check** (`src/lib/job-scam.ts`): fees, M-Pesa payments, "no interview" promises, WhatsApp-only or Gmail addresses for big employers are flagged, with or without the AI.

Jobs are saved in the same private `task_progress` table (as `job:<id>` rows), so no new SQL is needed. Without the AI key, pasted adverts, the match check, CV and questions use simple rules.

## Accounts and Digital Locker

Sign-in uses a phone number and an SMS code through [Supabase](https://supabase.com). Until Supabase is set up, the app runs in demo mode: any Kenyan number works with the code `123456`, and Locker files stay on the device for that session.

To connect Supabase:
1. Create a free project at supabase.com.
2. In **SQL Editor**, run `supabase/migrations/0001_locker.sql`. It creates the private `locker` bucket and rules so each person only sees their own files.
3. In **Authentication > Sign In / Providers**, turn on **Phone**. For testing, put placeholder values in the Twilio fields and add test numbers (for example `254748969001=123456`); test numbers never send a real SMS.
4. Copy the Project URL and anon key from **Settings > API** into `.env` (see `.env.example`), then restart `npm start`.

### Sending codes with Africa's Talking

Real SMS codes go through Africa's Talking using Supabase's Send SMS hook (`supabase/functions/send-sms`). With the hook on, Supabase uses it instead of Twilio.

1. Create an account at africastalking.com. The free sandbox uses the username `sandbox`, and its messages appear in the online simulator. For real SMS, create a live app, top it up, and use its username and API key.
2. Install the Supabase CLI and deploy the function from this folder:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your project ref>
   npx supabase functions deploy send-sms --no-verify-jwt
   ```
3. In Supabase, open **Authentication > Hooks**, add a **Send SMS** hook, choose **HTTPS**, and paste the function URL (`https://<project ref>.supabase.co/functions/v1/send-sms`). Click **Generate secret** and copy it.
4. Set the function's secrets:
   ```bash
   npx supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..." AT_USERNAME=sandbox AT_API_KEY=your-key
   ```
   Optionally add `AT_SENDER_ID` once Africa's Talking approves a sender name.

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
- `supabase/functions/send-sms/`: sends sign-in codes through Africa's Talking
- `src/components/`: shared UI pieces
- `src/constants/theme.ts`: colours and spacing
- `src/data/`: sample data used until the backend exists
- `assets/`: icons and splash images
