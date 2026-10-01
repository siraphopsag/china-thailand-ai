# C.A.L.L. — Cross ASEAN Language Legal

An AI-powered platform for cross-border business between Thailand and China: business context → AI understanding → language and cross-border context → legal and regulatory analysis → risks → verification → action. Not legal advice or certification.

- Languages: ไทย / 中文 / English (`src/locales/*`, add a language in `src/i18n/core.ts` + one column per message)
- Themes: light / dark via CSS variables (`src/index.css`); choice persisted in localStorage
- Deploy (Vercel): push to Git → vercel.com/new → import → Deploy (`vercel.json` is auto-detected)
- Local dev only: `npm install && npm run dev`; build: `npm run build`
- Env vars: see `.env.example` (none required for the demo). Demo data is fictional; regulatory data is sample data, not expert-reviewed.
- Tests: `npm test` runs the nominee-screening severity table and robustness checks (the expected levels are a proposed policy — have a lawyer review them before real use).
- Data: real and demo data are stored in separate browser slots; saved data is validated/repaired on load (`src/store.tsx`).
- Accessibility: menus and tab lists support keyboard navigation; colour pairs were checked for WCAG AA contrast in both themes (only decorative icons fall between 3:1 and 4.5:1).
- Assistant screening (`classifyIntent`) is a heuristic, not a safety system. A connected LLM needs its own policy and classifier.
- The API (`api/analyze-business.ts`) validates input (400), is same-origin only (403) and has a best-effort per-instance rate limit (429); use a shared store before connecting a paid LLM.
- UX: five primary areas (Home, Business, AI Analysis, Risks & Actions, Documents) around one five-step journey (`src/journey.ts`): tell us about the business → AI understands → AI checks key issues → see what AI found → know what to do next. The interview is a 3-question quick start (`src/interview.ts`); unanswered ownership facts count as "unknown", never as "fine", and the Business page says why each missing fact is needed. AI Analysis runs on arrival and shows every finding in the same structure (what we found · why it matters · what we don’t know · what to verify · what to do next · status) with its tasks; task status is shared by Home, AI Analysis, Risks & Actions and Documents (`src/hooks.ts`). Ownership and employment are detail pages inside AI Analysis.

## Legal information: sources, verification, updates

The app never presents a legal record as "verified" unless a named human checked it against the official text **and** nothing has changed since. Everything is derived from three files in `src/data/legal/` (plus the summary text in `src/locales/data.ts`):

| File | Who writes it | What it holds |
|---|---|---|
| `registry.ts` | admin, via Pull Request | every known legal topic/instrument, its agency site, the **official text link (`textUrl`)** and whether it is monitored (`watch`). Instruments known by name only are marked `gap: true` (no summary in the app). |
| `observed.ts` | `npm run legal:watch` (GitHub Action, daily) | hash of each monitored official text. It can only *lower* trust. |
| `reviews.ts` | `npm run legal:review`, run by the reviewer under their own name | the human sign-off, tied to the exact summary text and the exact version of the official text. **Currently empty: no record has been reviewed.** |

**Trust states** (`src/data/legal/trust.ts`, one pure function, fails closed): `VERIFIED` only with a complete review + an https official text link + unchanged summary + unchanged official text + a review younger than 90 days (+ a change monitor that ran in the last 30 days for monitored records). Otherwise `UNVERIFIED` (never reviewed / nothing to compare with), `CHANGED` (summary edited or official text changed since the review), `STALE` (review or monitor too old), `GAP` (known by name only).

**Answers** (`src/services/legalGuard.ts`): every answer gets server-built citations (jurisdiction, law, provisions, effective date, reviewer, status) and a grounding level. Questions asking for an exact penalty, figure, period or article number are answered only by quoting a verified record verbatim; otherwise the app says it cannot answer. Any answer (including a future LLM draft, which must go through `guardResponse(..., { requireSources: true })`) is withheld if it cites unknown sources or states an amount, article number, penalty or deadline that a verified source does not literally contain. These are pattern heuristics, deliberately conservative.

**Getting a record reviewed** (an admin task, done outside the app):
1. Add the official text link to `registry.ts` (`textUrl`, https, a deep link to the law itself, not the agency home page) and set `watch: true`.
2. `npm run legal:watch` – records the version of the text.
3. The reviewer reads the official text against the summary, then runs `npm run legal:review -- --id <id> --by "Name, role" [--effective YYYY-MM-DD] [--provisions "…"] --yes` (without `--yes` it is a dry run).
4. Open a Pull Request; a **second** legal reviewer approves it before merge. Information goes live only after the merge.
5. If the official text later changes, the daily monitor records it and the record drops to "source changed" until it is reviewed again. A record that has never had a text link cannot be monitored; many agency sites cannot be monitored at all (JavaScript shells, bot walls): the monitor reports those as failed and keeps the old hash.

Limits: hash comparison only says *something* on the page changed (layout changes can cause false alarms), it does not say what. The admin page is read-only and has no login; approval is the Pull Request, not a button. The summaries in `locales/data.ts` were written by an AI assistant, are not legal advice, and must be reviewed by a qualified lawyer before real use.
