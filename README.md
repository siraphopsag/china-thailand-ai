# China–Thailand AI Business Entry & Compliance Platform

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
