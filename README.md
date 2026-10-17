# Maqsad

Maqsad is a trust and case-management platform for students, job seekers, and overseas education and recruitment agents. It is being built in milestones. Today it has:

- Student and agent registration, login and role-based dashboards (student, agent, admin), with roles checked on the server and in Postgres Row Level Security.
- A public website in English and Urdu (right-to-left), with a pricing page read from `src/lib/plans.ts`.
- Student and agent profiles, an agent directory, student discovery for agents, matching suggestions with reasons, and connection requests.
- Agent credential submission with an optional document, and admin review that sets the status students see.
- The document checker at `/check`, described below.

Features that are not built yet are listed in `src/lib/features.ts` as `false`. Public pages, pricing and dashboard menus read that file and label those features "Coming soon", so nothing is advertised before it works.

The document checker covers what Pakistani students and families receive before they pay anyone: foreign university offers, scholarship offers, visa letters, agent WhatsApp messages, degrees and transcripts, overseas job offers and internship offers. It reports red flags with the evidence behind each one and an Urdu summary for parents. It never says a document is genuine. The best result is "no red flags found", followed by an official contact the user can confirm with.

## Run it

```bash
cp .env.example .env.local   # add a free Gemini key and a free Groq key
pnpm install
supabase start               # local Postgres and Auth in Docker; copy its API URL and publishable key into .env.local
pnpm dev                     # http://localhost:3000
pnpm test                    # unit tests: rule checks, auth and profile validation, matching, translation keys
pnpm test:e2e                # with supabase and the app running: auth, role routing, RLS, connections, credentials, files
```

`pnpm test:e2e` targets `http://localhost:3000`; set `APP_URL` to test another server, such as `next start` on a different port.

`supabase start` applies the migrations in `supabase/migrations`. To start over, run `supabase db reset`. Nobody can sign up as an admin. Register a normal account, then promote it with the SQL in `supabase/seed.sql`.

## Accounts, roles and languages

- **Auth.** Supabase email and password, through server actions in `src/app/actions/auth.ts`. Input is validated with Zod (`src/lib/auth-schema.ts`).
- **Roles.** Each user has a row in `public.profiles` with a role (`student`, `agent`, `admin`) and a status. The signup trigger only accepts student or agent. RLS lets users read and rename their own row, and lets active admins read every row. Column grants stop users changing their own role or status.
- **Authorization.** `src/lib/auth.ts` reads the role from `profiles`, never from user metadata, which users can edit. Every dashboard layout and page calls `requireRole()`. `src/proxy.ts` refreshes the session and redirects signed-out users early, but it is not the security check.
- **Profiles and privacy.** Student profiles start hidden. Agents see a student only when the student turns on visibility, is connected to them, or asked to connect first. Discovery shows students as "Student · field" until they accept; their name reaches an agent only after that. Agent profiles and names are visible to every signed-in user.
- **Connections.** Rows in `public.connections` change only through the database functions `request_connection`, `respond_connection` and `withdraw_connection`, because the Supabase API is reachable from the browser. They allow one open request per pair, only the recipient can accept, and an agent can have at most 20 requests waiting (an anti-spam cap until plan limits arrive in milestone 5).
- **Matching.** `src/lib/matching.ts` scores shared destinations, field, education level, goal and a verified credential, with fixed weights and no model. Every suggestion lists its reasons, and the page says a match is not a guarantee.
- **Credentials.** Agents can insert credentials but cannot set their status (column grants). Only `review_credential()`, which checks `is_admin()`, changes it. "Verified" means an admin verified at least one credential; plans and payments play no part. Documents go to the private `credentials` storage bucket under the agent's own folder; only that agent and admins can read them, through 5-minute signed links.
- **Languages.** URLs start with the locale (`/en/...`, `/ur/...`) so pages can be prerendered with Cache Components. Strings live in `messages/en.json` and `messages/ur.json`, loaded by next-intl from the `[locale]` root parameter. `pnpm test` fails if the two files have different keys. Report findings and the action plan steps from `src/lib` are still English only, and are marked `lang="en"` so they stay left-to-right on Urdu pages.

To work on the UI without using model quota, set `MOCK_AI=1` in `.env.local`. The API then returns sample reports from `src/lib/mock.ts`, built with the real rule checks and risk level but no Gemini or Groq calls. Paste `high`, `medium`, `low`, `incomplete` or `error` to pick one. An uploaded file gives the high-risk report, or the low-risk one if its name contains "real" or "flinders". Production builds ignore the flag.

## How a check works

`POST /api/analyze` takes a PDF or image up to 4 MB (the Vercel request limit) or pasted text, and streams progress as NDJSON. A document that was already fully checked returns its cached report without calling any model.

1. **Extract** (`src/lib/gemini.ts`). Gemini reads the file and returns typed fields: issuer, payment details, emails, reference numbers, pressure tactics, and any text that tries to instruct an AI. It uses `gemini-3.8-flash` and retries on `gemini-3.5-flash-lite` when the free quota returns 429 or the model is overloaded (5xx).
2. **Rule checks** (`src/lib/checks.ts`). This step is plain code with no model involved. It checks:
   - payment through JazzCash, Easypaisa, money transfer services or crypto
   - a payee name that doesn't match the issuer
   - Gmail or other free email senders, and email domains that differ from the website
   - CAS, DLI, CRICOS and SEVIS number formats
   - domain age through RDAP
   - PDF producer and edit dates
   - internships that give payment instructions (real internships don't charge fees)
   - National CERT's [fake notifications](https://pkcert.gov.pk/fake-notifications.asp) list, matched on a shared domain or phone, or the same notice subject. A name match alone counts for nothing, because the notices name the real body being impersonated
   - live student visa registers: the UKVI sponsor register (UK), the designated learning institutions list (Canada) and CRICOS (Australia). A DLI number or CRICOS code in the document must exist and belong to the issuer, and CRICOS also gives the official website to compare with the document's domains
3. **Web research** (`src/lib/groq.ts`). `openai/gpt-oss-120b` on Groq searches with `browser_search` for official sites, registers (HEC, Bureau of Emigration, approved agent lists) and scam reports.
4. **Report**. A second Groq call, on `openai/gpt-oss-20b` so it uses a separate free quota, turns the research notes into findings with source URLs and writes the English and Urdu summary.

The risk level comes from `riskLevel()`, which counts red flags. A model can add red flags but cannot remove one. Text injected into a document therefore can't lower the risk. "No red flags found" needs every check to have run and at least one fact confirmed by an official source; otherwise the report says the checks are incomplete.

## After the report

- **Connections** (`src/lib/network.ts`). The domains, issuer emails, phones, payee and account numbers in each checked document are stored as SHA-256 hashes. A later document that shares one lists the earlier checks it matched (risk, type, issuer, date). Anyone can put a real university's phone in a fake letter, so connections never add red flags or change the risk.
- **Already paid or shared something?** (`src/lib/actions.ts`). The student ticks what they already gave away (bank transfer, JazzCash or Easypaisa, card, password or OTP, CNIC, passport, transcripts) and gets steps in order of urgency: helplines (NCCIA 1799, wallets, Sunwai, PTA, DGI&P), a complaint draft built from the report, and a verification email addressed only to the official contact found by web research. Nothing is sent; the student copies the text or opens their own email app.
- **Official channels** (`src/lib/alternatives.ts`). For any result other than "no red flags found", a fixed list of official places to find the same kind of opportunity (HEC, Chevening, USEFP, DAAD, UCAS, EduCanada, BEOE and others). The links were checked on 2026-10-17.

## Known limits

- Groq's free tier allows about 8K tokens per minute and 200K a day per model. A check uses roughly 10-15K tokens, so expect a few dozen fresh checks a day. When a limit is hit, the report still shows the rule checks, a warning and "checks incomplete".
- The report cache lives in server memory, so a restart or another server instance starts empty.
- RDAP returns no registration date for `.ac.uk` and `.pk` domains, so domain age is only checked for domains like `.com` and `.org`.
- Live registers cover the UK, Canada and Australia. The UK is checked by name for university offers only; Canada and Australia also check any DLI number or CRICOS code the document quotes, whatever its type. A name must match the register's wording ("UCL" won't match "University College London"), so a miss is a medium flag, not high. Canada's list only has post-secondary institutions. The US publishes its SEVP school list only as a PDF, so the US and every other country rely on web research.
- Connections live in server memory like the report cache, so they only link checks handled by the same server instance since its last restart. Links quoted in a scam letter (for example a gov.uk page) can link unrelated documents.
- PKCERT's fake notifications page lists 8 notices with the text only inside images, and none are about education today, so that check will rarely fire. If the page can't be fetched, the report doesn't become "checks incomplete".
- Helplines and opportunity links are hard-coded and can go stale.
- Gemini's Google Search grounding is not on the free tier, which is why search runs on Groq.
- The document checker is public and has no per-user limit yet. Plan limits from `src/lib/plans.ts` are shown on the pricing page but enforced only from milestone 5.
