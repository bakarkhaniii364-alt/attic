# Attic

A private, collaborative web app for couples. Share notes, chat in real-time, play games together, draw doodles, keep a video journal, watch lo-fi music together, and build shared memories in your personal digital attic.

## Features

- **Messaging**: Real-time chat with message history
- **Shared Documents**: Collaborative text editing with live cursor tracking
- **Chess**: Play chess games together with move history
- **Video Calls**: WebRTC-enabled peer-to-peer video calling
- **Scrapbook**: Upload and organize shared photos and memories
- **Doodles**: Draw together in real-time with a shared canvas
- **Lo-Fi Music Player**: Listen to background music together
- **Time Capsule**: Save moments and memories to revisit later
- **Calendar**: Sync events and anniversaries
- **Arcade Games**: Competitive mini-games with leaderboards
- **Dream Journal**: Private journal entries with shared notes option

## Tech Stack

- **Frontend**: React 18 + Vite (ESM)
- **Backend**: Supabase (PostgreSQL + Row-Level Security)
- **Realtime**: Supabase Realtime (PostgreSQL changes)
- **Storage**: Supabase Storage (private buckets for media)
- **P2P**: WebRTC with Yjs (CRDT for collaborative editing)
- **Styling**: Tailwind CSS
- **E2E Testing**: Playwright
- **Deployment**: Vercel

## Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **npm** or **yarn**
- A **Supabase project** (free tier works fine): [Create one](https://supabase.com)
- A WebRTC TURN server (optional, for calling behind NAT) — [Metered.ca](https://metered.ca) is recommended

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/bakarkhaniii364-alt/attic.git
cd attic
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Then open `.env` and fill in:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_SITE_URL`: Your public domain (for SEO, e.g., `https://your-site.com`)
- `VITE_TURN_*`: Your TURN server credentials (or comment out to disable calling)

You can find these in [Supabase Dashboard](https://supabase.com) → Settings → API.

### 3. Initialize the database

1. Go to your Supabase dashboard → SQL Editor
2. Run each migration file in order from `supabase/migrations/`:
   - `01_init.sql` — Create app_state table
   - `02_auth_schema.sql` — Create rooms and auth functions
   - `03_migration_normalized.sql` — Create chat, assets, arcade tables
   - `04_security_hardening.sql` — Add rate limits and RLS policies
   - `05_storage_policies.sql` — Configure private storage buckets

For manual setup or troubleshooting, see [supabase/migrations/README](supabase/migrations/README.md).

### 4. Start development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Running Tests

### WebSocket Relay (for local WebRTC testing)

Some features (like video calls) require a WebSocket relay to establish peer connections. Start it in a separate terminal:

```bash
npm run test:relay
```

### E2E Tests

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Test files are in `tests/` directory.

## Deployment

The project is configured for **Vercel**. The `vercel.json` file is already set up.

### Deploy to Vercel

1. Push your repo to GitHub
2. Connect your GitHub repo to [Vercel Dashboard](https://vercel.com)
3. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.
4. Deploy!

See [SECURITY_DEPLOYMENT.md](SECURITY_DEPLOYMENT.md) for production hardening tips.

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:relay` | Start WebSocket relay for testing |
| `npm run lint` | Check code style with ESLint |
| `npm run lint:fix` | Auto-fix code style issues |
| `npm run security` | Run security hardening script |
| `npm run audit` | Audit npm dependencies |

## Database

The app uses **Supabase** (managed PostgreSQL) with **Row-Level Security (RLS)** to ensure each couple only sees their own data.

**Key tables:**
- `rooms` — Links two users (a couple)
- `app_state` — Synchronized app data (CRDT state)
- `chat_messages` — Chat history
- `shared_assets` — Uploaded images and doodles
- `arcade_sessions` — Active game sessions
- `room_player_stats` — Game scores and leaderboards
- `user_stats` — Per-user stats (streaks, achievements)
- `room_metadata` — Room settings, anniversaries, pet data

For detailed database setup and migration guide, see [docs/db/README.md](docs/db/README.md) and [MIGRATION_EXECUTION_GUIDE.md](docs/MIGRATION_EXECUTION_GUIDE.md).

## Security & Privacy

- All data is encrypted in transit (HTTPS + WSS)
- Row-Level Security (RLS) prevents cross-room data access
- Private storage buckets ensure only room members can access media
- Rate limiting on pairing to prevent brute-force attacks
- See [SECURITY_HARDENING.md](SECURITY_HARDENING.md) for more details

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on making changes to the project.

## License

MIT — See [LICENSE](LICENSE) for details.

## Questions?

- Open an issue on GitHub
- Check [docs/](docs/) for detailed guides and audit reports

