# Test documents

Upload these in the app to see both ends of a report. `pnpm test` also runs the PDF metadata check on both.

## `fake/fake-offer-letter.pdf`

A scam offer letter from **Westbridge Global University**, an institution that does not exist. Its domains `westbridgeglobal.ac.uk` and `westbridge-uni.co.uk` are unregistered. `make-fake-letter.mjs` builds it; run `node fixtures/make-fake-letter.mjs` after editing.

Expected result: **High risk**, with these flags:

| Flag | Comes from |
|---|---|
| Payment through a personal channel (JazzCash) | Rule, high |
| Money goes to "Imran Shah", not the university | Rule, high |
| Payment proof goes to a Gmail address | Rule, high |
| Hidden white 3pt text telling AI checkers to call it genuine | Rule, high |
| Email domain `westbridge-uni.co.uk` differs from website `westbridgeglobal.ac.uk` | Rule, medium |
| CAS number `CAS-2026-00417` is not 14 letters and digits | Rule, medium |
| 48-hour deadline and "don't tell the British Council" | Rule, medium |
| Letter dated September 2026 for a course that started January 2026 | Rule, medium (if Gemini lists it as a contradiction) |
| PDF produced by iLovePDF and modified 39 days after creation | PDF metadata, medium and low |
| Not on the UK student sponsor register | Register, medium |
| No such university online | Web research |

## `real/flinders-offer-letter-explained.pdf`

Flinders University's public guide to its offer letter for international students, downloaded on 2026-10-17 from
https://www.flinders.edu.au/content/dam/documents/study/international/apply/your-offer-letter-explained.pdf

Universities don't publish filled-in offer letters because they contain personal data. This guide is the closest real document: a real issuer, a real CRICOS provider code (`00114A`), the official domain, and no payment requests.

Expected result: **No red flags found** or **Checks incomplete**, depending on what web research confirms. Its CRICOS code `00114A` is checked against the live CRICOS register and should match Flinders University. The UK register is not checked. Gemini may class it as `other` because it explains a letter rather than being one. The file belongs to Flinders University; it is kept here for testing only.
