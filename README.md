# Attic

A private, real-time couples app. Each "attic" is a secure space for exactly **2 users** to share notes, chat, play games, make video calls, draw together, and build shared memories. All collaboration happens in real-time via Supabase and WebRTC.

## Features

- **Messaging**: Real-time chat with end-to-end encryption support
- **Shared Documents**: Collaborative text editing with Yjs (CRDT) and live cursor tracking
- **Chess**: Play chess together with move history and game state persistence
- **Video/Audio Calls**: WebRTC peer-to-peer calling with Supabase Realtime signaling
- **Scrapbook**: Upload and organize shared photos with cloud storage
- **Doodles**: Draw together in real-time on a shared canvas
- **Lo-Fi Music Player**: Listen to background music together
- **Arcade Games**: Competitive mini-games with leaderboards
- **Time Capsule**: Save and revisit moments together
- **Calendar**: Sync events and anniversaries
- **Dream Journal**: Personal or shared journal entries

## Architecture

- **2-user only**: Each "attic" = exactly 1 couple (creator + partner). All real-time features are peer-to-peer between these 2 users only.
- **Signaling**: WebRTC offers/answers + ICE candidates flow through **Supabase Realtime channels** (no separate relay needed on Cloudflare).
- **Collaborative Editing**: Yjs (CRDT) with IndexedDB persistence — survives page refreshes.
- **Real-time Updates**: Supabase PostgreSQL changes streamed via Realtime subscriptions.

## Tech Stack

- **Frontend**: React 18 + Vite (ESM)
- **Backend**: Supabase (PostgreSQL + Row-Level Security)
- **Realtime**: Supabase Realtime (signaling + subscriptions)
- **Storage**: Supabase Storage (private buckets for media)
- **P2P**: WebRTC (native) + Yjs (CRDT for collaborative editing)
- **Styling**: Tailwind CSS + PostCSS
- **E2E Testing**: Playwright
- **Deployment**: Cloudflare Pages

## Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **npm** or **yarn**
- A **Supabase project** (free tier works fine): [Create one](https://supabase.com)
- A **Cloudflare account** (free tier works): [Sign up](https://cloudflare.com)
- Optional: A WebRTC TURN server for calling behind restrictive NAT ([Metered.ca](https://metered.ca))

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

### E2E Tests

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Test files are in `tests/` directory.

## Deployment

The project deploys to **Cloudflare Pages** with Supabase for backend.

### Deploy to Cloudflare Pages

1. **Connect GitHub**: In [Cloudflare Dashboard](https://dash.cloudflare.com), go to **Pages** → **Connect to Git** → authorize & select this repo
2. **Build Settings**: 
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: **18** (set in `wrangler.toml` or Pages settings)
3. **Environment Variables**: In Pages → Settings → Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SITE_URL`
   - Optional: `VITE_TURN_URL`, `VITE_TURN_URL_SSL`, `VITE_TURN_USERNAME`, `VITE_TURN_PASSWORD`
4. **Deploy**: Push to main branch → Cloudflare Pages auto-deploys

**Routing**: The `public/_redirects` file handles SPA routing (all routes → `/index.html`).

See [SECURITY_DEPLOYMENT.md](SECURITY_DEPLOYMENT.md) for production hardening tips.

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start local dev server (http://localhost:5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test:e2e` | Run Playwright E2E tests |
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

