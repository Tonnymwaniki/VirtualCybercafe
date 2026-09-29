# Virtual Cybercafe

Virtual Cybercafe is a mobile app for Android and iOS. It is an AI-powered cybercafe in your pocket: tell an attendant what you need, and it helps with government services, CVs, documents, printing and payments. The same code runs as an Android app, an iOS app and a website.

## Version one

The first public version is a "digital cyber desk": the AI attendant, Documents, Jobs & CV, My Details and the Locker (plan: step 1 of 10 is done). Government, Education, Business, Travel, Print Hub and Payments stay in the code but show "Coming soon" on Home and Services, their screens show a Coming soon page, and the attendant only offers what is live. The switch lives in `src/data/launch.ts`; add `EXPO_PUBLIC_FULL_APP=1` to `.env` to turn every service back on while developing.

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
- **Open screens** (`src/data/catalogue.ts`): any workspace, guided task or tool, as a button under its reply. Some open filled in, e.g. Travel with the country, an invoice with the customer, Tenders or Jobs with the search words.
- **Check the Locker**: lists the signed-in person's saved files (read-only).
- **Write documents**: letters and forms-ready text the person downloads as a PDF.
- **Web search** (Kenya-focused) and **official links**.

It never submits forms or makes payments; the person does that. Tapping a service tile opens the chat with that service, so the same agent handles both.

### The chat screen

`src/app/chat.tsx` with the parts in `src/components/chat/`:
- **Welcome** (`welcome.tsx`): an empty chat greets the person by the first name in My Details and the time of day, shows unfinished work, and suggests starters picked from their details (`src/lib/chat-suggest.ts`), such as a KRA PIN when none is saved or a passport that expires within 9 months. No AI call.
- **Designed answers**: replies are Markdown (`markdown.tsx`). Under them come cards (`cards.tsx`): a service card with the service's icon and colour, a checklist that ticks items already in the Locker, numbered steps, a fee, an official site (with an "Official" badge for .go.ke, .ac.ke and .or.ke), a document with a paper preview and PDF / Locker / Print Hub buttons, and a red warning. The attendant makes them with `show_checklist`, `show_steps`, `show_fee` and `show_warning`.
- **Chat history** (`history-panel.tsx`, `src/lib/chat-store.ts`): ☰ opens past chats grouped by day, with search, pin, rename and delete. It stays open on the left on screens 900px or wider. A signed-in person's chats are saved to their account as `task_progress` rows `chat:<id>` (no new SQL); guests keep them on the phone. Photos are not saved, only a note that one was sent.
- **Chat basics**: typing dots, times and day separators, copy / read aloud / share on each reply (tap and hold your own message), follow-up chips after each reply, a box that grows to 5 lines (Enter sends on a computer), a jump-to-latest arrow, and "Not sent · Tap to retry" when the server can't be reached.
- **Photos**: the + button takes or picks a photo (a screenshot of an eCitizen error, a document). It is shrunk on the phone and sent with the message; it costs a little more of the daily allowance.
- **Actions with confirm cards** (`action-card.tsx`, `src/lib/chat-actions.ts`): the attendant can offer to save details to My Details (`save_my_details`), start a guided task with Locker documents ticked and answers filled (`start_task`), track a job advert (`track_job`, with the scam rules) or a trip (`track_trip`), and add a reminder that shows first under Continue on Home until its date (`add_reminder`, stored as `remind:` rows). Nothing changes until the person taps **Do it**; then the card offers Open and Undo, and its state is saved with the chat. At most two per reply.
- **Reading pages**: the attendant can read a link the person pastes, or an official page, with web fetch. If the model or account can't use web fetch, the chat carries on without it.

### Finding your way (free, no AI)

`src/data/catalogue.ts` lists everything the app does, with English, Swahili and Sheng keywords. `src/lib/route-intent.ts` matches what people type against it on the phone:
- Home has an **Ask** button (styled like a message box) that opens the full chat screen; the example chips under it open the chat with that request sent.
- In chat, a short request that clearly names one screen ("KRA PIN", "nataka visa") is answered on the phone with a button, without calling the AI. Questions ("how much...?", "bei gani?") still go to the attendant.
- Every screen has a **Help** button. It opens the chat already told which screen you are on, with a free explanation of that screen first.
- When a guided task is done, the Track step suggests what to do next (e.g. a business permit after the business name).

### AI costs and limits

- Every Claude reply is logged to `.cache/usage.jsonl` (tokens, web searches and an estimated cost, per feature). Open `/api/usage?days=7` on the server for totals. The Anthropic Console shows the real bill.
- AI results that rarely change (requirement checks, visa rules, job, course and tender searches) are cached in `.cache/ai-cache.json`, so they survive restarts and aren't paid for twice.
- Each phone gets `AI_DAILY_LIMIT` AI requests a day (default 40), and the whole app stops calling the AI for the day once `AI_DAILY_BUDGET_USD` is spent (default 1). Answers from the cache don't count. Set either in `.env`.

## Document Workbench

Documents > Document Workbench gets files ready for online forms. Every tool runs on the phone and nothing is uploaded unless you tap Save to Locker. Each result shows a card with the measured size, type and pages or pixels, plus Download and Save to Locker.

- **Check upload rules:** pick a form's rule, then a file. Type, size, pixels and pages are ticked or crossed, and **Fix it** makes a copy that passes (converting, resizing, shrinking or turning a photo into a PDF). Official rules (`src/data/presets.ts`) are only added when the portal or its owner states them, with the source link and a "last checked" date; so far eCitizen passport photo and documents (Kenya Embassy DC guide), HEF / HELB photo and documents (hef.co.ke) and Karatina University admission. None of these publishes a KB or pixel limit, so only what they state is checked. Common limits (PDF under 1 MB, JPG under 200 KB, 600 × 600 photo and others) cover the rest. For photos, **Check the photo** asks the AI (`/api/photo-check`, about one chat message) about the face, background, glasses and sharpness; the Passport photo screen has it too. The research notes are in the project files (`plans/upload-rules-research.json`).
- **Fit an upload limit:** Shrink a PDF (to 200 KB, 500 KB, 1 MB, 2 MB, 5 MB or any size), Shrink a photo, Resize a photo (exact pixels or longest side, JPG or PNG, optional KB limit) and Passport photo.
- **Passport photo** (`src/lib/workbench/passport.ts`): from any clear photo, the digital photo for online forms (600 × 600 JPG under 200 KB, cropped a little above the middle where the face usually is) and an A4 print sheet with cut lines: 6 photos at 2 × 2 in (the Kenyan passport print size in the Kenya Embassy e-passport guide) or 8 at 35 × 45 mm for visas and other forms. Both have the usual result card, so they can go to the Locker, a job application or Print at any cyber. The AI check of face, background, glasses and sharpness is on tap. The face is never edited. In the chat, send a photo and say "passport photo" (free, no AI).
- **Make a PDF:** Scan a document (turn, then Original, Brighter, Clean or Black & white), Photos to PDF and Join PDFs (PDFs and photos, in any order).
- **Change a PDF:** Pick or split pages (keep, remove, or one file per page, with page previews) and PDF to JPG.

- **From the chat:** tap + in the attendant chat to send PDFs and photos (several at once), then say what you need. Clear requests are done on the phone straight away and cost nothing: "under 1MB", "600x600", "put these in one PDF", "pages 1-3", "to JPG", "scan it" or "for HELB" (`src/lib/file-intent.ts`). Anything else goes to the attendant, which sees a list of the files (and can read a PDF up to 3 MB or the first photo) and asks the phone to do the work with its `work_on_files` tool. Either way the phone runs the Workbench tool (`src/lib/workbench/run.ts`) and the reply shows the same result card, with numbers measured on the real file. Files stay on the phone only while the app is open; saved chats keep their names and sizes, so use Download or Save to Locker to keep a file.

- **Use in application:** every result card has **Use in application**. Pick a saved job and the file goes into your Locker and onto that job's supporting documents; the job's Apply step lists it and ticks it for the application pack.

- **Print at any cyber** (`/studio/print`, also on every result card): choose a PDF or photo (photos become an A4 PDF), optionally add a 4-number PIN, and tap **Make print code**. The app shows a QR code and a short code like `VC-7K2M9Q`. At any cyber, the attendant scans the QR code or opens the print page (`/p`) on their computer and types the code (and PIN). They open the PDF, print it, and tap **Printed**. No cyber account is needed. Codes last 24 hours or until printed; 5 wrong PINs lock a code; each connection gets 30 failed lookups an hour; the file sits in a private `quickprint` bucket and the cyber only gets a link to that one file, which expires after 24 hours. The app deletes printed and expired files the next time the owner opens Print at any cyber. Run `supabase/migrations/0004_quick_print.sql` once in the SQL Editor. Set `EXPO_PUBLIC_SITE_URL` once the app is hosted so the QR codes point to the real site; until then they point to the development server, which only computers on the same Wi-Fi can reach. Without Supabase, codes work only in the same browser or phone (demo).

How it works: `src/lib/workbench/` holds the tools (`pdf-lib` for PDFs, `expo-image-manipulator` for photos). Reading PDF pages (PDF to JPG, previews, shrinking scans) and scan clean-up run in a hidden web page (`react-native-webview` on the phone, a hidden frame on the web) with pdf.js from cdnjs, so the first use needs internet. Shrink a PDF first re-saves the file losslessly; if that isn't enough, it redraws the pages as pictures at the best quality that fits, and says so. Text PDFs will shrink better with the small server planned for launch.

## Look and feel

- **Continue on Home** (`src/lib/continue.ts`): unfinished guided tasks, trips, jobs and tenders, each with its next step.
- **One step at a time** (`src/components/stepper.tsx`): guided tasks, jobs and trips show "Step 2 of 5", a progress bar, dots to jump between steps, and Back/Next.
- **English / Kiswahili** (`src/lib/i18n.tsx`): the EN/SW switch in the header changes Home, the menus, service tiles, buttons, step names and the chat. With Kiswahili on, the attendant answers in Swahili by default. Task details (requirements and steps) are still in English.
- **Read aloud** (`expo-speech`): a speaker button under each attendant reply. Talking to type needs a development build, so the mic says it's coming soon.
- **Mascot** (`src/components/mascot.tsx`, an SVG robot) in its own section at the top of Home beside the greeting and a speech bubble, with first-visit tips under it, and the Services tab grouped by area with every task as a chip.

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
- **Job application card in the chat:** "I need to apply for a job" (free, no AI) or the attendant's `show_job_application` tool shows a live checklist: job advert, career details, CV and cover letter, supporting documents, and sending it. It reads the same saved job as the Jobs screen and ticks items as the person works in either place (`src/components/chat/job-task-card.tsx`). Without a linked job it offers saved jobs, and a job saved from an advert pasted in the chat links itself. Each line opens the right step (`/jobs/<id>?step=`).
- **Apply** builds one application pack PDF (letter, CV and ticked certificate photos from the Locker), shows the email draft for email applications, and puts the form helper beside job portal forms.
- **Track** keeps the status (Saved, Applied, Shortlisted, Interview, Offer) and deadline, with interview practice questions.
- Every advert gets a **scam check** (`src/lib/job-scam.ts`): fees, M-Pesa payments, "no interview" promises, WhatsApp-only or Gmail addresses for big employers are flagged, with or without the AI.

Jobs are saved in the same private `task_progress` table (as `job:<id>` rows), so no new SQL is needed. Without the AI key, pasted adverts, the match check, CV and questions use simple rules.

## Education

The Education tile opens `src/app/education/`:

- **KUCCPS course choice** (`kuccps.tsx`): the student types their KCSE grades once (saved in My Details). The app estimates the mean grade and shows which levels the usual minimums allow. The education agent (`src/server/edu-agent.ts`, `/api/education`) searches the KUCCPS sites for programmes that fit their grades and interests, marked Likely, Possible or Reach, with requirements and cut-offs as KUCCPS states them. Choices can be ordered and progress ticked. Only KUCCPS decides placement. A **job market check** compares the chosen courses (or any typed ones) against live Kenyan job adverts and official statistics: demand level, jobs, pay as stated in sources, skills wanted, and related courses with stronger demand.
- **Student funding (HEF / HELB), HELB compliance certificate and KNEC certificate replacement** are guided tasks in `src/data/gov-tasks.ts` (`eduTasks`), using the same five steps, live requirements check and form helper as Government Services.
- **Admission letter or fee structure:** a photo or pasted text is read into fees, total, how to pay, reporting date and a what-to-bring checklist. Fees going to a personal phone number are flagged.

The KUCCPS plan and letters are stored in `task_progress` as `edu:` rows (`src/lib/record-store.ts`), so no new SQL is needed.

## Print Hub

The Print tile opens `src/app/print/`. A customer picks a file from the Locker or the phone (PDF pages are counted automatically), chooses copies, colour and sides, picks a partner shop and sees the price. Sending gives a pickup code (like `VC-4821`) with a QR code, and the status moves from Sent to Printing, Ready and Collected. The customer pays the shop at pickup.

A cybercafe owner opens **Own a cybercafe? Open the shop screen** (`print/shop.tsx`) to register their shop and prices, see incoming jobs, open each file, mark jobs Printing and Ready, and check the customer's code at pickup.

Run `supabase/migrations/0003_print.sql` in the Supabase SQL Editor once. It creates `print_shops`, `print_jobs` and a private `print` bucket. Customers see only their jobs, shops see only jobs sent to them, and a shop can open a file only while its job is open; the file is deleted when the job is collected or cancelled. Without Supabase, Print Hub runs on the device with a demo shop so both sides can be tried.

## Business

The Business tile (`src/app/business/`) fills everything from My Details > Business:

- **Register and comply:** business name, county business permit, turnover tax, limited company and AGPO certificate. These use the same five guided steps and form helper as Government Services (`bizTasks` in `src/data/gov-tasks.ts`).
- **Documents:** numbered invoices, receipts and quotations with totals and the M-Pesa till, price lists, and posters, social media posts and business plans written by the agent from the owner's answers (`src/server/biz-agent.ts`). On the phone each one can be saved to the Locker or sent straight to Print Hub.
- **Tenders:** the agent searches tenders.go.ke and other official sites, checks the AGPO set-aside against the owner's group and flags fee requests and unofficial links (`src/lib/biz-sample.ts`).

Documents and tenders are `biz:` rows in `task_progress`, so no new SQL is needed.

## Travel & Visa

The Travel tile (`src/app/travel/`) fills everything from My Details > Travel (passport details):

- **Trips:** the agent checks what a Kenyan passport holder needs for the destination and purpose on official immigration and embassy sites (`src/server/travel-agent.ts`), with a passport-validity warning, a document checklist that spots Locker files, the visa form with the form helper (`src/data/visa-form.ts`), supporting letters (cover, invitation, sponsor, itinerary) and progress.
- **Working abroad:** checks a recruitment agency on the National Employment Authority's site and a job offer for common scam signs (`src/lib/travel-sample.ts`).
- **Kenya eTA for a visitor:** a guided task (`travelTasks` in `src/data/gov-tasks.ts`).

Trips are `travel:` rows in `task_progress`, so no new SQL is needed.

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
  - `studio/`: Document Workbench (shrink a PDF or photo, resize, passport photo, scan, photos to PDF, join, pick or split pages, PDF to JPG)
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
