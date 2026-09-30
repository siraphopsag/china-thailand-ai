# China–Thailand AI Business Entry & Compliance Platform

- Languages: ไทย / 中文 / English (`src/locales/*`, add a language in `src/i18n/core.ts` + one column per message)
- Themes: light / dark via CSS variables (`src/index.css`); choice persisted in localStorage
- Deploy (Vercel): push to Git → vercel.com/new → import → Deploy (`vercel.json` is auto-detected)
- Local dev only: `npm install && npm run dev`; build: `npm run build`
- Env vars: see `.env.example` (none required for the demo). Demo data is fictional; regulatory data is sample data, not expert-reviewed.
