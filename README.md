# C.A.L.L. — Cross ASEAN Language Legal

A prototype that connects employers and job seekers across language, culture and law, starting with Thailand ↔ China. Job seekers pin up to 5 provinces with their skills; employers post what they need for a province; posts reach seekers step by step (same area and field → same area → whole country); a seeker accepts and the case is forwarded to an employment agency (simulated). Not legal advice. All data is sample data kept in the visitor's own browser.

- Live: https://china-thailand-ai.vercel.app (`main`); work in progress: branch `poc/jobboard` → Vercel Preview. Decisions are logged in `CHANGELOG-POC.md`; system diagrams are in `docs/diagrams/`.
- Languages: ไทย / 中文 / English (`src/locales/*`, add a language in `src/i18n/core.ts` + one column per message)
- Themes: light / dark via CSS variables (`src/index.css`); choice persisted in localStorage
- Local dev: `npm install && npm run dev`; build: `npm run build`; tests: `npm test`
- Matching rules: `src/domain/match/` (pure, tested); browser state: `src/matchData.tsx` (validated on load, never trusted as is)
- Employer pre-check (`src/domain/match/precheck.ts`) is a simple rule set labelled "simulated AI" — not a real AI review and not legal advice.
- No server API, no accounts and no payments yet. The admin sign-in is a prototype gate whose credentials are in the client code (visible to anyone) — replace it before real use.
- Accessibility: WCAG 2.2 A/AA checks run in the tests (contrast of colour tokens in both themes, labels, focus, motion with an on/off switch in Settings).

## Legal information: sources, verification, updates

The app never presents a legal record as "verified" unless a named human checked it against the official text **and** nothing has changed since. Everything is derived from three files in `src/data/legal/` (plus the summary text in `src/locales/data.ts`); the app shows them on the Legal sources page (Prepare → Legal information):

| File | Who writes it | What it holds |
|---|---|---|
| `registry.ts` | admin, via Pull Request | every known legal topic/instrument, its agency site, the **official text link (`textUrl`)** and whether it is monitored (`watch`). Instruments known by name only are marked `gap: true` (no summary in the app). |
| `observed.ts` | `npm run legal:watch` (GitHub Action, daily) | hash of each monitored official text. It can only *lower* trust. |
| `reviews.ts` | `npm run legal:review`, run by the reviewer under their own name | the human sign-off, tied to the exact summary text and the exact version of the official text. **Currently empty: no record has been reviewed.** |

**Trust states** (`src/data/legal/trust.ts`, one pure function, fails closed): `VERIFIED` only with a complete review + an https official text link + unchanged summary + unchanged official text + a review younger than 90 days (+ a change monitor that ran in the last 30 days for monitored records). Otherwise `UNVERIFIED` (never reviewed / nothing to compare with), `CHANGED` (summary edited or official text changed since the review), `STALE` (review or monitor too old), `GAP` (known by name only).

**Getting a record reviewed** (an admin task, done outside the app):
1. Add the official text link to `registry.ts` (`textUrl`, https, a deep link to the law itself, not the agency home page) and set `watch: true`.
2. `npm run legal:watch` – records the version of the text.
3. The reviewer reads the official text against the summary, then runs `npm run legal:review -- --id <id> --by "Name, role" [--effective YYYY-MM-DD] [--provisions "…"] --yes` (without `--yes` it is a dry run).
4. Open a Pull Request; a **second** legal reviewer approves it before merge. Information goes live only after the merge.
5. If the official text later changes, the daily monitor records it and the record drops to "source changed" until it is reviewed again. A record that has never had a text link cannot be monitored; many agency sites cannot be monitored at all (JavaScript shells, bot walls): the monitor reports those as failed and keeps the old hash.

Limits: hash comparison only says *something* on the page changed (layout changes can cause false alarms), it does not say what. Approval is the Pull Request, not a button. The summaries in `locales/data.ts` were written by an AI assistant, are not legal advice, and must be reviewed by a qualified lawyer before real use.
