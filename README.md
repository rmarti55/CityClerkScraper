# Santa Fe Civic Dashboard

A clean, usable interface for **City of Santa Fe Agendas & Minutes**—meeting calendar, agendas, packets, and minutes. The product is branded as [City of Santa Fe Agendas & Minutes](https://santafenm.portal.civicclerk.com/) to align with the city's official portal; this repo is the "Santa Fe Civic Dashboard" project.

Built because the official CivicClerk portal is terrible.

## Features

- **Monthly calendar view** - Browse meetings by month with easy navigation
- **Category filtering** - Filter meetings by category (City Council, Planning Commission, etc.); mobile-friendly category filter modal
- **Global search** - Server-side search across all meetings with pagination
- **Client-side search** - Fast fuzzy search within the current month using Fuse.js
- **Search history** - Recent searches saved locally for quick access
- **Meeting detail pages** - View full meeting info with all attached files
- **PDF preview** - View PDFs inline or download files
- **File metadata** - See file sizes and PDF page counts before downloading
- **Sticky header** - Quick access to search and navigation while scrolling
- **URL-synced search** - Search state persists in URL for sharing
- **Activity badges** - File counts, "Upcoming" status, and "Has Agenda" at a glance (meeting status badges)
- **Database caching** - Age-based caching for fast performance
- **Historical data** - Backfill utility to import 5 years of meeting history
- **Loading skeletons** - Smooth loading states throughout the UI
- **Auth** - Magic-link login (email), session, sign in/out via NextAuth
- **Follows** - Follow categories (e.g. Governing Body, Planning Commission) and favorite individual meetings; My Follows page
- **Governing body pages** - Dedicated page per committee with scroll-restore and committee-specific meeting list
- **Committee summaries** - LLM-generated summaries (OpenRouter) for committee pages, with 24h cache
- **Email digest** - Optional daily digest for followed categories (cron + Resend)
- **Login modal** - In-app login without leaving the page
- **Latest business** - Summary/snippet on committee pages (latest business card)

## Tech Stack

- [Next.js 16.1.6](https://nextjs.org/) with App Router
- [React 19.2.3](https://react.dev/)
- [TypeScript 5](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Drizzle ORM 0.45.1](https://orm.drizzle.team/)
- [Neon Serverless PostgreSQL](https://neon.tech/)
- [NextAuth v5 (Auth.js)](https://authjs.dev/) with [Drizzle adapter](https://authjs.dev/reference/adapter/drizzle) for magic-link auth
- [Resend](https://resend.com/) for transactional email (magic link and digest)
- [Fuse.js 7.1.0](https://www.fusejs.io/) for client-side fuzzy search
- [pdf-lib 1.17.1](https://pdf-lib.js.org/) for PDF metadata extraction
- Optional: [OpenRouter](https://openrouter.ai/) for LLM-generated committee summaries

## Quick Start

```bash
npm install
```

Set up your environment variables (see below), then:

```bash
npm run dev
```

Open http://localhost:3000

## Environment Variables

Create a `.env` or `.env.local` file in the project root. See `.env.example` for a template.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon recommended) |
| `NEXTAUTH_SECRET` | Yes (for auth) | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes (for auth) | App URL (e.g. `http://localhost:3000`) |
| `RESEND_API_KEY` | Yes (for magic link) | From [Resend](https://resend.com/api-keys) |
| `CRON_SECRET` | Yes (for digest) | Secret for protecting `/api/cron/notifications` |
| `EMAIL_FROM` | No | Custom from address (requires verified domain in Resend) |
| `OPENROUTER_API_KEY` | No | For AI committee summaries; omit for fallback text |

**Note:** The CivicClerk API is publicly accessible—no API key needed. The app's auth, email, and cron features require the variables above.

## Database Setup

This project uses PostgreSQL (via Neon) with Drizzle ORM.

1. Create a database on [Neon](https://neon.tech/) (free tier available)
2. Copy the connection string to your `.env` file
3. Run migrations (new installs use Drizzle only):

```bash
npx drizzle-kit push
```

**Existing databases:** If you have an old auth schema (e.g. integer `users.id`, `password_hash`), run the one-off migration to Auth.js before or instead of relying only on Drizzle: `npm run migrate:auth` (or `tsx scripts/migrate-auth.ts`). New installs should use `npx drizzle-kit push` only.

4. (Optional) Backfill historical data:

```bash
npm run backfill        # Full 5-year backfill
npm run backfill:probe  # Test with 1 month first
```

   After deploying the meeting-time timezone fix, re-run backfill for affected date ranges so existing events get the correct `start_date_time` (e.g. 4:00 PM instead of 9:00 AM).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run backfill` | Backfill 5 years of historical meeting data |
| `npm run backfill:probe` | Test backfill with first month only |
| `npm run refresh-file-counts` | Refresh `file_count` and file metadata in the database |
| `npm run migrate:auth` | One-off migration from old auth schema to Auth.js (see Database setup) |

## API Routes

Internal API endpoints used by the frontend:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | GET | Returns all cached events from database |
| `/api/search` | GET | Server-side search with pagination |
| `/api/file/[id]` | GET | File proxy with local caching |
| `/api/file/[id]/metadata` | GET | Returns file size and PDF page count |
| `/api/categories` | GET | Returns all event categories with meeting counts |
| `/api/events/by-category` | GET | Filter events by category with pagination |
| `/api/auth/[...nextauth]` | * | NextAuth handlers (sign in, callback, session) |
| `/api/committees/[slug]/summary` | GET | Cached LLM committee summary; optional `?refresh=true` |
| `/api/cron/notifications` | GET | Cron: send daily digest (protected by `CRON_SECRET`) |
| `/api/favorites` | GET/POST/DELETE | User favorites (meeting IDs) |
| `/api/follows/categories` | GET/POST/DELETE | User category follows |

### Search API

```
GET /api/search?q=budget&page=1&limit=20
```

Parameters:
- `q` - Search query (required, min 2 characters)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)

### File API

```
GET /api/file/123?download=true
```

Parameters:
- `download` - Set to `true` for download, omit for inline view

### File Metadata API

```
GET /api/file/123/metadata
```

Returns:
- `size` - File size in bytes
- `pageCount` - Number of pages (for PDFs, null for other file types)

### Categories API

```
GET /api/categories
```

Returns all event categories with meeting counts. Cached for 1 hour.

### Category Filter API

```
GET /api/events/by-category?categoryName=City%20Council&page=1&limit=20
```

Parameters:
- `categoryName` - Category name to filter by (required)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/[...nextauth]/  # NextAuth handlers
│   │   ├── categories/    # GET event categories
│   │   ├── committees/[slug]/summary/  # LLM committee summary
│   │   ├── cron/notifications/  # Daily digest cron
│   │   ├── events/        # GET all cached events
│   │   │   └── by-category/  # Filter by category
│   │   ├── favorites/     # User favorites
│   │   ├── file/[id]/     # File proxy with caching
│   │   │   └── metadata/  # File size & page count
│   │   ├── follows/categories/  # User category follows
│   │   └── search/        # Server-side search
│   ├── auth/error/        # Auth error page
│   ├── auth/verify/       # Magic link verification
│   ├── governing-body/    # Committee page (per slug)
│   ├── meeting/[id]/      # Meeting detail page
│   ├── my-follows/        # User's follows and favorites
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── skeletons/        # Loading skeleton components
│   ├── CategoryFilter.tsx       # Category dropdown filter
│   ├── CategoryFilterModal.tsx  # Mobile category picker
│   ├── CategoryFilterResults.tsx  # Filtered results display
│   ├── CommitteeMeetingList.tsx  # Committee meeting list
│   ├── FollowCategoryButton.tsx # Follow category action
│   ├── FileMetadata.tsx   # File size & page count display
│   ├── GoverningBodyScrollRestore.tsx  # Scroll restore on committee page
│   ├── HomePage.tsx       # Main home page
│   ├── LatestBusinessCard.tsx   # Summary on committee page
│   ├── LoginButton.tsx    # Sign in / account dropdown
│   ├── LoginModal.tsx     # In-app login modal
│   ├── MeetingCard.tsx    # Meeting card display
│   ├── MeetingList.tsx    # Meeting list with grouping
│   ├── MeetingStatusBadges.tsx  # Upcoming, Has Agenda, etc.
│   ├── MobileSearchModal.tsx    # Mobile search UI
│   ├── MonthPicker.tsx    # Month/year navigation
│   ├── Pagination.tsx     # Pagination controls
│   ├── SearchBar.tsx      # Search input
│   ├── SearchableContent.tsx    # Search + history + global results
│   ├── SearchResults.tsx  # Search results display
│   ├── StickyHeader.tsx   # Sticky header on scroll
│   └── ...
├── context/               # React context providers
│   ├── AuthContext.tsx    # SessionProvider wrapper
│   ├── CommitteeContext.tsx   # Committee summary cache
│   ├── EventsContext.tsx  # Global events state
│   └── LoginModalContext.tsx  # Login modal open state
├── hooks/                 # Custom React hooks
│   ├── useCategories.ts  # Fetch & cache categories
│   ├── useCategoryFilter.ts  # Category filtering with pagination
│   ├── useDeviceCapabilities.ts  # Mobile, touch, hover
│   ├── useFollows.ts      # Favorites and category follows
│   ├── useGlobalSearch.ts # Server-side search
│   ├── useSearch.ts       # Client-side Fuse.js search
│   └── useSearchHistory.ts  # Recent search persistence
└── lib/                   # Core libraries
    ├── auth.ts            # NextAuth config
    ├── breakpoints.ts     # Media queries and touch targets
    ├── civicclerk.ts      # API client & caching logic
    ├── committees.ts      # Committee config and slugs
    ├── datetime.ts        # Date/time parsing
    ├── types.ts           # TypeScript types (e.g. CivicEvent)
    ├── utils.ts           # Utility functions
    ├── db/                # Database layer
    │   ├── index.ts       # Drizzle connection
    │   └── schema.ts      # Database schema
    └── llm/               # LLM committee summaries
        ├── openrouter.ts  # OpenRouter API client
        └── summary.ts     # Committee summary generation
```

## Caching Strategy

Events are cached in PostgreSQL with age-based expiration:

| Event Age | Cache Duration |
|-----------|----------------|
| > 30 days | Permanent (never expires) |
| 7-30 days | 24 hours |
| < 7 days | 1 hour |

The app also uses:
- **Client-side caching** - Events stored in localStorage, refreshed every 30 minutes
- **Stale cache fallback** - If the CivicClerk API fails, stale cached data is served

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (production URL), `RESEND_API_KEY`, and `CRON_SECRET` (if using Vercel Cron for `/api/cron/notifications`). Optionally set `EMAIL_FROM` (requires verified domain in Resend) and `OPENROUTER_API_KEY` for AI committee summaries.
4. Deploy

## CivicClerk API Reference

The CivicClerk API uses OData-style endpoints (publicly accessible):

| Purpose | Endpoint |
|---------|----------|
| List events | `GET /v1/Events?$filter=startDateTime ge {date}` |
| Single event | `GET /v1/Events({id})` |
| Event files | `GET /v1/Events({id})/Files` |
| Meeting details | `GET /v1/Meetings({agendaId})` |
| Download file | `GET /v1/Files({fileId})/$value` |

Base URL: `https://santafenm.api.civicclerk.com`

## Legal Note

This tool accesses public records via public API endpoints. It's civic homework, not vandalism.

- All meeting data is public record
- Requests are cached to minimize API load
- Don't abuse the API
