# Santa Fe Civic Dashboard

A clean, usable interface for **City of Santa Fe Agendas & Minutes**—meeting calendar, agendas, packets, and minutes. The product is branded as [City of Santa Fe Agendas & Minutes](https://santafenm.portal.civicclerk.com/) to align with the city's official portal; this repo is the "Santa Fe Civic Dashboard" project.

Built because the official CivicClerk portal is terrible.

## Features

- **Monthly calendar view** - Browse meetings by month with easy navigation
- **Category filtering** - Filter meetings by category (City Council, Planning Commission, etc.); mobile-friendly category filter modal
- **Global search** - Server-side search across all meetings with pagination
- **Document search** - Server-side full-text search across meeting document content
- **Client-side search** - Fast fuzzy search within the current month using Fuse.js
- **Search history** - Recent searches saved locally for quick access
- **Meeting detail pages** - View full meeting info with all attached files
- **Structured agenda items** - Parsed agenda items with sponsors, committee review schedule, and expandable descriptions
- **AI agenda summaries** - "Agenda at a Glance" per meeting via OpenRouter (Claude Haiku), summarizing key items
- **Document chat (RAG)** - Chat with meeting documents and attachments using retrieval-augmented generation (OpenRouter embeddings + LLM)
- **PDF preview** - View PDFs inline or download files
- **File & attachment viewers** - Dedicated pages for viewing files and agenda item attachments
- **File metadata** - See file sizes and PDF page counts before downloading
- **Share agenda items** - Share button for individual agenda items
- **Sticky header** - Quick access to search and navigation while scrolling
- **Meeting sticky header** - Contextual sticky header on meeting detail pages with back navigation
- **URL-synced search** - Search state persists in URL for sharing
- **Meeting status badges** - "Happening Now", "Today at [time]", "Upcoming", "Canceled", file counts, and "Has Agenda" at a glance
- **Event location** - Display meeting location and address
- **Database caching** - Age-based caching for fast performance
- **Historical data** - Backfill utility to import 5 years of meeting history
- **Loading skeletons** - Smooth loading states throughout the UI
- **Auth** - Magic-link login (email), session, sign in/out via NextAuth
- **Login modal** - In-app login without leaving the page
- **Follows** - Follow categories (e.g. Governing Body, Planning Commission) and favorite individual meetings; My Follows page
- **Notification preferences** - User-configurable notification settings
- **Committee pages** - Dedicated pages for Governing Body and Public Works with scroll-restore and committee-specific meeting lists
- **Committee summaries** - LLM-generated summaries (OpenRouter) for committee pages, with 24h cache
- **Latest business** - Summary/snippet on committee pages (latest business card)
- **Email digest** - Optional daily digest for followed categories (cron + Resend)
- **Toast notifications** - In-app toast notification system
- **Admin tools** - Committee member scraping endpoint

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
- [Luxon 3.5](https://moment.github.io/luxon/) for timezone-aware date/time handling (America/Denver)
- [pdf-lib 1.17.1](https://pdf-lib.js.org/) for PDF metadata extraction
- [unpdf 1.4](https://github.com/nicolo-ribaudo/unpdf) for PDF text extraction (document chat, text API)
- [Vitest](https://vitest.dev/) for unit testing
- Optional: [OpenRouter](https://openrouter.ai/) for AI features (committee summaries, agenda summaries, document chat, embeddings)

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
| `AUTH_SECRET` | Yes (for auth) | Generate with `openssl rand -base64 32` (`NEXTAUTH_SECRET` also works) |
| `NEXTAUTH_URL` | Yes (for auth) | App URL (e.g. `http://localhost:3000`) |
| `RESEND_API_KEY` | Yes (for magic link) | From [Resend](https://resend.com/api-keys) |
| `CRON_SECRET` | Yes (for digest) | Secret for protecting `/api/cron/notifications` |
| `EMAIL_FROM` | No | Custom from address (requires verified domain in Resend) |
| `OPENROUTER_API_KEY` | No | For AI features: committee summaries, agenda summaries, document chat, and embeddings; omit to disable AI features |

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
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run backfill` | Backfill 5 years of historical meeting data |
| `npm run backfill:probe` | Test backfill with first month only |
| `npm run refresh-file-counts` | Refresh `file_count` and file metadata in the database |
| `npm run migrate:auth` | One-off migration from old auth schema to Auth.js (see Database setup) |

## API Routes

Internal API endpoints used by the frontend:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | GET | Returns all cached events from database |
| `/api/events/[id]/refresh` | POST | Refresh a single event from the CivicClerk API |
| `/api/events/by-category` | GET | Filter events by category with pagination |
| `/api/search` | GET | Server-side meeting search with pagination |
| `/api/search/documents` | GET | Full-text search across document content |
| `/api/categories` | GET | Returns all event categories with meeting counts |
| `/api/file/[id]` | GET | File proxy with local caching |
| `/api/file/[id]/metadata` | GET | Returns file size and PDF page count |
| `/api/file/[id]/text` | GET | Returns extracted text from a file (PDF text extraction) |
| `/api/file/[id]/chat` | POST | RAG-based chat over a file document |
| `/api/attachment/[id]` | GET | Attachment proxy with caching |
| `/api/attachment/[id]/metadata` | GET | Returns attachment metadata |
| `/api/attachment/[id]/chat` | POST | RAG-based chat over an attachment |
| `/api/meeting/[id]/agenda-summary` | GET | AI-generated agenda item summaries (cached 1h) |
| `/api/committees/[slug]/summary` | GET | Cached LLM committee summary; optional `?refresh=true` |
| `/api/committees/[slug]/overview` | GET | Committee overview data |
| `/api/auth/[...nextauth]` | * | NextAuth handlers (sign in, callback, session) |
| `/api/favorites` | GET/POST/DELETE | User favorites (meeting IDs) |
| `/api/follows/categories` | GET/POST/DELETE | User category follows |
| `/api/notifications/preferences` | GET/PATCH | User notification preferences |
| `/api/cron/notifications` | GET | Cron: send daily digest (protected by `CRON_SECRET`) |
| `/api/admin/committees/[slug]/scrape-members` | POST | Admin: scrape committee members from external source |

### Search API

```
GET /api/search?q=budget&page=1&limit=20
```

Parameters:
- `q` - Search query (required, min 2 characters)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)

### Document Search API

```
GET /api/search/documents?q=zoning+amendment
```

Full-text search across meeting document content via the CivicClerk Search API.

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

### File Text API

```
GET /api/file/123/text
```

Returns extracted plain text from a PDF file (used internally by the document chat RAG pipeline).

### File Chat API

```
POST /api/file/123/chat
```

RAG-based document chat. Extracts text, chunks, embeds, retrieves relevant passages, and generates an LLM response. Requires `OPENROUTER_API_KEY`.

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

### Agenda Summary API

```
GET /api/meeting/456/agenda-summary
```

Returns AI-generated summaries for each agenda item in a meeting. Uses OpenRouter (Claude 3.5 Haiku). Cached for 1 hour with stale-while-revalidate of 2 hours. Returns 503 if `OPENROUTER_API_KEY` is not configured.

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── admin/committees/[slug]/scrape-members/  # Admin: scrape members
│   │   ├── attachment/[id]/       # Attachment proxy
│   │   │   ├── metadata/         # Attachment metadata
│   │   │   └── chat/             # RAG chat over attachment
│   │   ├── auth/[...nextauth]/   # NextAuth handlers
│   │   ├── categories/           # GET event categories
│   │   ├── committees/[slug]/
│   │   │   ├── overview/         # Committee overview
│   │   │   └── summary/          # LLM committee summary
│   │   ├── cron/notifications/   # Daily digest cron
│   │   ├── events/               # GET all cached events
│   │   │   ├── [id]/refresh/     # Refresh single event
│   │   │   └── by-category/      # Filter by category
│   │   ├── favorites/            # User favorites
│   │   ├── file/[id]/            # File proxy with caching
│   │   │   ├── metadata/         # File size & page count
│   │   │   ├── text/             # Extracted text from file
│   │   │   └── chat/             # RAG chat over file
│   │   ├── follows/categories/   # User category follows
│   │   ├── meeting/[id]/
│   │   │   └── agenda-summary/   # AI agenda summaries
│   │   ├── notifications/preferences/  # Notification prefs
│   │   └── search/               # Server-side search
│   │       └── documents/        # Document content search
│   ├── auth/error/        # Auth error page
│   ├── auth/verify/       # Magic link verification
│   ├── governing-body/    # Governing Body committee page
│   │   └── procedural-rules/  # Procedural rules page
│   ├── meeting/[id]/      # Meeting detail page
│   │   ├── file/[fileId]/       # File viewer page
│   │   └── attachment/[attachmentId]/  # Attachment viewer page
│   ├── my-follows/        # User's follows and favorites
│   ├── profile/           # User profile page
│   ├── public-works/      # Public Works committee page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── skeletons/         # Loading skeleton components
│   ├── AgendaItemContent.tsx      # Parsed agenda item display (sponsors, committee review)
│   ├── AgendaSummary.tsx          # AI "Agenda at a Glance" summary
│   ├── CategoryFilter.tsx         # Category dropdown filter
│   ├── CategoryFilterModal.tsx    # Mobile category picker
│   ├── CategoryFilterResults.tsx  # Filtered results display
│   ├── CommitteeMeetingList.tsx   # Committee meeting list (upcoming/past split)
│   ├── DocumentChatView.tsx       # RAG document chat UI
│   ├── DocumentSearchResults.tsx  # Document search results display
│   ├── EventLocation.tsx          # Meeting location display
│   ├── FileMetadata.tsx           # File size & page count display
│   ├── FollowCategoryButton.tsx   # Follow category action
│   ├── GlobalSearchResults.tsx    # Global search results display
│   ├── GoverningBodyScrollRestore.tsx  # Scroll restore on committee page
│   ├── HomePage.tsx               # Main home page
│   ├── LatestBusinessCard.tsx     # Summary on committee page
│   ├── LoginButton.tsx            # Sign in / account dropdown
│   ├── LoginModal.tsx             # In-app login modal
│   ├── MeetingCard.tsx            # Meeting card display
│   ├── MeetingList.tsx            # Meeting list with grouping
│   ├── MeetingRefreshButton.tsx   # Refresh single meeting data
│   ├── MeetingStatusBadges.tsx    # Happening Now, Today, Upcoming, etc.
│   ├── MeetingStickyHeader.tsx    # Sticky header on meeting detail pages
│   ├── MobileSearchModal.tsx      # Mobile search UI
│   ├── MonthPicker.tsx            # Month/year navigation
│   ├── Pagination.tsx             # Pagination controls
│   ├── PublicWorksScrollRestore.tsx  # Scroll restore on Public Works page
│   ├── SearchBar.tsx              # Search input
│   ├── SearchableContent.tsx      # Search + history + global results
│   ├── SearchResults.tsx          # Search results display
│   ├── ShareAgendaItemButton.tsx  # Share individual agenda items
│   └── StickyHeader.tsx           # Sticky header on scroll
├── context/               # React context providers
│   ├── AuthContext.tsx        # SessionProvider wrapper
│   ├── CommitteeContext.tsx   # Committee summary cache
│   ├── EventsContext.tsx      # Global events state
│   ├── FollowsContext.tsx     # Favorites and category follows state
│   ├── LoginModalContext.tsx  # Login modal open state
│   └── ToastContext.tsx       # Toast notification system
├── hooks/                 # Custom React hooks
│   ├── useCategories.ts       # Fetch & cache categories
│   ├── useCategoryFilter.ts   # Category filtering with pagination
│   ├── useDeviceCapabilities.ts  # Mobile, touch, hover
│   ├── useFollows.ts          # Favorites and category follows
│   ├── useGlobalSearch.ts     # Server-side search
│   ├── useSearch.ts           # Client-side Fuse.js search
│   └── useSearchHistory.ts    # Recent search persistence
└── lib/                   # Core libraries
    ├── agenda-item-parser.ts  # Parse CivicClerk agenda text (sponsors, committees)
    ├── agenda-items.ts        # Collect agenda items with attachments
    ├── auth.ts                # NextAuth config
    ├── breakpoints.ts         # Media queries and touch targets
    ├── civicclerk.ts          # API client & caching logic
    ├── committees.ts          # Committee config and slugs
    ├── datetime.ts            # Date/time parsing (Luxon, America/Denver)
    ├── types.ts               # TypeScript types (e.g. CivicEvent)
    ├── utils.ts               # Utility functions
    ├── db/                    # Database layer
    │   ├── index.ts           # Drizzle connection
    │   └── schema.ts          # Database schema
    └── llm/                   # AI/LLM integrations
        ├── openrouter.ts      # OpenRouter API client
        ├── embeddings.ts      # OpenRouter embeddings for RAG
        ├── summary.ts         # Committee summary generation
        └── agenda-summary.ts  # Agenda item summary generation
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
3. Add environment variables: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` (production URL), `RESEND_API_KEY`, and `CRON_SECRET` (if using Vercel Cron for `/api/cron/notifications`). Optionally set `EMAIL_FROM` (requires verified domain in Resend) and `OPENROUTER_API_KEY` for AI features (committee summaries, agenda summaries, document chat).
4. Deploy

## CivicClerk API Reference

The CivicClerk API uses OData-style endpoints (publicly accessible):

| Purpose | Endpoint |
|---------|----------|
| List events | `GET /v1/Events?$filter=startDateTime ge {date}` |
| Single event | `GET /v1/Events({id})` (includes `publishedFiles`) |
| Meeting details & files | `GET /v1/Meetings({agendaId})` |
| Download file | `GET /v1/Meetings/GetMeetingFile(fileId={id},plainText=false)` |
| Full-text search | `GET /v1/Search?search={query}` |

Base URL: `https://santafenm.api.civicclerk.com`

Files are sourced from `Meetings({agendaId})`; when that returns 404, the app falls back to `Event.publishedFiles` from the Event entity. See [docs/civicclerk-api-endpoints-investigation.md](docs/civicclerk-api-endpoints-investigation.md) for the full API investigation.

## Legal Note

This tool accesses public records via public API endpoints. It's civic homework, not vandalism.

- All meeting data is public record
- Requests are cached to minimize API load
- Don't abuse the API
