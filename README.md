# Attic

Local development notes and quick start.

Prerequisites
- Node.js >= 18
- npm or yarn

Quick start

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Run tests (E2E with Playwright):

```bash
npx playwright install --with-deps
npm run test:e2e
```

Environment
- Copy `.env.example` to `.env` and fill values (e.g., `VITE_TMDB_API_KEY`, `VITE_SENTRY_DSN`).

Useful scripts
- `npm run dev` — start dev server
- `npm run build` — build production
- `npm run preview` — preview build
- `npm run test:e2e` — run Playwright E2E tests
- `npm run test:relay` — run WS relay script (local tests)

Contribution
See CONTRIBUTING.md for contributor guidelines.
