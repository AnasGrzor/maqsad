# Tasdeeq

Tasdeeq checks documents that Pakistani students and families receive before they pay anyone: foreign university offers, scholarship offers, visa letters, agent WhatsApp messages, degrees and transcripts, overseas job offers and internship offers. It reports red flags with the evidence behind each one and an Urdu summary for parents.

It never says a document is genuine. The best result is "no red flags found", followed by an official contact the user can confirm with.

## Run it

```bash
cp .env.example .env.local   # add a free Gemini key and a free Groq key
pnpm install
pnpm dev                     # http://localhost:3000
pnpm test                    # rule-check tests
```

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
