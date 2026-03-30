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
- **YouTube video integration** - Auto-discovers meeting recordings from the city's YouTube channel, fuzzy-matches videos to events by title and date
- **Meeting transcripts** - Extracts YouTube auto-captions, AI-cleans and structures them (executive summary, key decisions, action items, motions & votes, speaker attribution, topic tags)
- **Transcript search** - Full-text search across all meeting transcripts
- **Document chat (RAG)** - Chat with meeting documents and attachments using retrieval-augmented generation (OpenRouter embeddings + LLM)
- **PDF preview** - View PDFs inline or download files
- **File & attachment viewers** - Dedicated pages for viewing files and agenda item attachments
- **File metadata** - See file sizes and PDF page counts before downloading
- **Inline document viewer** - Split-pane PDF viewer on large screens with integrated chat; no page navigation needed
- **Share agenda items** - Share button for individual agenda items
- **Zoom/virtual meeting links** - Auto-extracted Zoom, Teams, and Google Meet links displayed as banner on meeting pages
- **Tab-based navigation** - Top-level tabs for All Meetings, each committee, and People directory
- **App header** - Unified sticky header with tabs, search, category filter, and contextual back navigation
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
- **People directory** - Browse city officials and staff by department with search, person popovers linked from agenda sponsors
- **Committee pages** - Dedicated pages for Governing Body and Public Works with committee-specific meeting lists
- **Committee summaries** - LLM-generated summaries (OpenRouter) for committee pages, with 24h cache
- **Latest business** - Summary/snippet on committee pages (latest business card)
- **Email digest** - Optional daily digest for followed categories (cron + Resend)
- **Toast notifications** - In-app toast notification system
- **Admin tools** - Committee member scraping and people directory sync endpoints

## Tech Stack

- [Next.js 16.1.6](https://nextjs.org/) with App Router
- [React 19.2.3](https://react.dev/)
- [TypeScript 5](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Drizzle ORM 0.45.1](https://orm.drizzle.team/)
- [Neon Serverless PostgreSQL](https://neon.tech/)
- [NextAuth v5 (Auth.js)](https://authjs.dev/) with [Drizzle adapter](https://authjs.dev/reference/adapter/drizzle) for magic-link auth
- [Resend](https://resend.com/) for transactional email (magic link and digest)
- [SWR](https://swr.vercel.app/) for client-side data fetching and caching
- [Fuse.js 7.1.0](https://www.fusejs.io/) for client-side fuzzy search
- [Luxon 3.5](https://moment.github.io/luxon/) for timezone-aware date/time handling (America/Denver)
- [pdf-lib 1.17.1](https://pdf-lib.js.org/) for PDF metadata extraction
- [unpdf 1.4](https://github.com/nicolo-ribaudo/unpdf) for PDF text extraction (document chat, text API)
- [youtube-transcript](https://github.com/Kakulukian/youtube-transcript) for YouTube caption extraction (no API key needed)
- [Vitest](https://vitest.dev/) for unit testing
- Optional: [OpenRouter](https://openrouter.ai/) for AI features (committee summaries, agenda summaries, document chat, transcript processing, embeddings)

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
| `OPENROUTER_API_KEY` | No | For AI features: committee summaries, agenda summaries, document chat, transcript processing, and embeddings; omit to disable AI features |
| `YOUTUBE_API_KEY` | No | YouTube Data API v3 key for video discovery; omit to disable transcript features. Get one at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (enable YouTube Data API v3) |
| `YOUTUBE_CHANNEL_ID` | No | YouTube channel ID to scan for meeting videos (defaults to City of Santa Fe channel) |

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
| `npm run backfill:transcripts` | Discover YouTube videos and extract transcripts (last 3 months) |
| `npm run backfill:transcripts:process` | Same as above + run AI processing on extracted transcripts |
| `tsx scripts/backfill-agenda-items.ts` | Backfill agenda items for events that have an `agenda_id` but no cached items |
| `tsx scripts/backfill-agenda-items.ts --probe` | Test agenda item backfill with first 10 events only |

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
| `/api/meeting/[id]/zoom-link` | GET | Auto-extracted Zoom/Teams/Meet link for a meeting |
| `/api/meeting/[id]/transcript` | GET | Transcript data (video info, summary, speakers, topics, cleaned text) |
| `/api/meeting/[id]/transcript` | POST | Trigger transcript extraction + AI processing (protected by `CRON_SECRET`) |
| `/api/meetings/media-status` | GET | Batch media availability flags (video, transcript, zoom) for event IDs |
| `/api/transcripts/search` | GET | Full-text search across meeting transcripts |
| `/api/saved-docs` | GET/POST/DELETE | User saved documents |
| `/api/people` | GET | List/search people directory (query, department filter) |
| `/api/people/[slug]` | GET | Single person by slug |
| `/api/committees/[slug]/summary` | GET | Cached LLM committee summary; optional `?refresh=true` |
| `/api/committees/[slug]/overview` | GET | Committee overview data |
| `/api/auth/[...nextauth]` | * | NextAuth handlers (sign in, callback, session) |
| `/api/favorites` | GET/POST/DELETE | User favorites (meeting IDs) |
| `/api/follows/categories` | GET/POST/DELETE | User category follows |
| `/api/notifications/preferences` | GET/PATCH | User notification preferences |
| `/api/cron/notifications` | GET | Cron: send daily digest (protected by `CRON_SECRET`) |
| `/api/cron/transcripts` | GET | Cron: run YouTube transcript pipeline (protected by `CRON_SECRET`) |
| `/api/admin/committees/[slug]/scrape-members` | POST | Admin: scrape committee members from external source |
| `/api/admin/people/sync` | POST | Admin: sync people directory from agendas, scraper, and seed data |
| `/api/admin/videos/unmatched` | GET | Admin: list YouTube videos not auto-matched to events |
| `/api/admin/videos/[videoId]/link` | POST | Admin: manually link a YouTube video to an event |

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

Full-text search across meeting document content using local PostgreSQL full-text search on cached files and agenda items.

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

### Zoom Link API

```
GET /api/meeting/456/zoom-link
```

Returns an auto-extracted Zoom, Teams, or Google Meet link for a meeting. Scans PDF annotations and text from agenda documents. Result is cached on the event record.

### Transcript API

```
GET /api/meeting/456/transcript
```

Returns transcript data for a meeting: video metadata, AI-generated summary (executive summary, key decisions, action items, motions & votes), speaker-attributed segments, topic tags, and cleaned transcript text. Cached for 1 hour with stale-while-revalidate of 24 hours.

```
POST /api/meeting/456/transcript
```

Triggers transcript extraction and AI processing for a meeting's linked YouTube video. Protected by `CRON_SECRET` (via `Authorization: Bearer` header or `?secret=` query param). Requires `OPENROUTER_API_KEY` for AI processing.

### Transcript Search API

```
GET /api/transcripts/search?q=water+rates&limit=20
```

Parameters:
- `q` - Search query (required, min 2 characters)
- `limit` - Max results (default: 20, max: 50)

Full-text search across all completed meeting transcripts. Returns matching transcript snippets with event and video metadata.

### Media Status API

```
GET /api/meetings/media-status?ids=917,962,963
```

Parameters:
- `ids` - Comma-separated event IDs (required)

Returns a map of `{ hasVideo, hasTranscript, hasZoomLink }` flags for each event ID. Used by meeting cards to show media availability badges. Cached for 5 minutes.

### People API

```
GET /api/people?q=martinez&department=City%20Council
```

Parameters:
- `q` - Search query (optional, searches name, title, department, email)
- `department` - Filter by department (optional)

Returns active people sorted by department then name.

```
GET /api/people/john-doe
```

Returns a single person by slug, or 404.

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── admin/
│   │   │   ├── committees/[slug]/scrape-members/  # Admin: scrape members
│   │   │   ├── people/sync/      # Admin: sync people directory
│   │   │   └── videos/           # Admin: video management
│   │   │       ├── unmatched/    # List unmatched YouTube videos
│   │   │       └── [videoId]/link/  # Manually link video to event
│   │   ├── attachment/[id]/       # Attachment proxy
│   │   │   ├── metadata/         # Attachment metadata
│   │   │   └── chat/             # RAG chat over attachment
│   │   ├── auth/[...nextauth]/   # NextAuth handlers
│   │   ├── categories/           # GET event categories
│   │   ├── committees/[slug]/
│   │   │   ├── overview/         # Committee overview
│   │   │   └── summary/          # LLM committee summary
│   │   ├── cron/
│   │   │   ├── notifications/   # Daily digest cron
│   │   │   └── transcripts/     # YouTube transcript pipeline cron
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
│   │   │   ├── agenda-summary/   # AI agenda summaries
│   │   │   ├── transcript/       # Meeting transcript (GET data, POST trigger processing)
│   │   │   └── zoom-link/        # Auto-extracted Zoom/Teams/Meet link
│   │   ├── meetings/media-status/     # Batch video/transcript/zoom availability
│   │   ├── notifications/preferences/  # Notification prefs
│   │   ├── people/               # People directory list/search
│   │   │   └── [slug]/           # Single person by slug
│   │   ├── saved-docs/            # User saved documents
│   │   ├── search/               # Server-side search
│   │   │   └── documents/        # Document content search
│   │   └── transcripts/search/   # Transcript full-text search
│   ├── auth/error/        # Auth error page
│   ├── auth/verify/       # Magic link verification
│   ├── governing-body/    # Governing Body committee page
│   │   └── procedural-rules/  # Procedural rules page
│   ├── meeting/
│   │   ├── layout.tsx           # Scroll-reset layout for meeting routes
│   │   └── [id]/               # Meeting detail page
│   │       ├── file/[fileId]/       # File viewer page
│   │       └── attachment/[attachmentId]/  # Attachment viewer page
│   ├── my-follows/        # User's follows and favorites
│   ├── people/            # People directory page
│   ├── profile/           # User profile page
│   ├── public-works/      # Public Works committee page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── skeletons/         # Loading skeleton components
│   ├── AgendaItemContent.tsx      # Parsed agenda item display (sponsors, committee review)
│   ├── AgendaItemsList.tsx        # Collapsible agenda items with attachments and AI summaries
│   ├── AgendaSummary.tsx          # AI "Agenda at a Glance" summary
│   ├── AppHeader.tsx              # Unified app header with tabs, search, back navigation
│   ├── CategoryFilter.tsx         # Category dropdown filter
│   ├── CategoryFilterModal.tsx    # Mobile category picker
│   ├── CategoryFilterResults.tsx  # Filtered results display
│   ├── ChatMessageList.tsx        # Scrollable chat message bubbles (shared by document chat views)
│   ├── CommitteeMeetingList.tsx   # Committee meeting list (upcoming/past split)
│   ├── CopyButton.tsx             # Copy-to-clipboard with toast feedback
│   ├── DocumentCardWrapper.tsx    # Highlighted card wrapper for active document
│   ├── DocumentChatView.tsx       # RAG document chat UI (file/attachment viewer pages)
│   ├── DocumentSearchResults.tsx  # Document search results display
│   ├── EventLocation.tsx          # Meeting location display
│   ├── FileMetadata.tsx           # File size & page count display
│   ├── FollowCategoryButton.tsx   # Follow category action
│   ├── FollowingTabContent.tsx    # Following tab: followed categories and favorite meetings
│   ├── GlobalSearchResults.tsx    # Global search results display
│   ├── HomePage.tsx               # Main home page with tab routing
│   ├── icons.tsx                  # Shared SVG icon components (YouTube, Document, Refresh, etc.)
│   ├── InlineDocumentChat.tsx     # Chat panel for inline document viewer
│   ├── InlineDocumentViewer.tsx   # Split-pane PDF + chat viewer (large screens)
│   ├── LatestBusinessCard.tsx     # Summary on committee page
│   ├── LoginButton.tsx            # Sign in / account dropdown
│   ├── LoginModal.tsx             # In-app login modal
│   ├── MeetingCard.tsx            # Meeting card display
│   ├── MeetingDetailLayout.tsx    # Responsive meeting page layout (single/split column)
│   ├── MeetingList.tsx            # Meeting list with grouping
│   ├── MeetingTranscript.tsx      # YouTube video embed + AI transcript (summary, speakers, search)
│   ├── MeetingRefreshButton.tsx   # Refresh single meeting data
│   ├── MeetingStatusBadges.tsx    # Happening Now, Today, Upcoming, etc.
│   ├── MeetingsProviders.tsx      # Composed EventsProvider + CommitteeProvider
│   ├── MobileSearchModal.tsx      # Mobile search UI
│   ├── MonthPicker.tsx            # Month/year navigation
│   ├── Pagination.tsx             # Pagination controls
│   ├── PeopleDirectory.tsx        # People directory with search and department filter
│   ├── PersonLink.tsx             # Inline person link with popover
│   ├── PersonPopover.tsx          # Person detail popover (title, dept, contact)
│   ├── SaveDocumentButton.tsx     # Bookmark/save document toggle
│   ├── SavedDocsTabContent.tsx    # Saved documents tab content with search and viewer
│   ├── SearchBar.tsx              # Search input
│   ├── SearchableContent.tsx      # Search + history + global results
│   ├── SearchResults.tsx          # Search results display
│   ├── ShareAgendaItemButton.tsx  # Share individual agenda items
│   ├── TabBar.tsx                 # Top-level navigation tabs
│   ├── TranscriptSearchResults.tsx # Transcript search results display
│   ├── ViewDocumentButton.tsx     # Opens document in inline viewer or new tab
│   └── ZoomLinkBanner.tsx         # Zoom/Teams/Meet link banner on meeting pages
├── context/               # React context providers
│   ├── AuthContext.tsx            # SessionProvider wrapper
│   ├── CommitteeContext.tsx       # Committee meeting list fetch cache (TTL-based)
│   ├── DocumentViewerContext.tsx  # Inline document viewer state (open/close PDF, chat endpoint)
│   ├── EventsContext.tsx          # Global events state
│   ├── FollowsContext.tsx         # Favorites and category follows state
│   ├── LoginModalContext.tsx      # Login modal open state
│   ├── SavedDocsContext.tsx        # Saved document keys with optimistic toggle updates
│   ├── SearchContext.tsx          # Search query, category, history, mobile search state
│   └── ToastContext.tsx           # Toast notification system
├── hooks/                 # Custom React hooks
│   ├── useCategories.ts       # Fetch & cache categories
│   ├── useDeviceCapabilities.ts  # Mobile, touch, hover
│   ├── useDocumentChat.ts     # Chat endpoint with message history management
│   ├── useDocumentSearch.ts   # Debounced document content search
│   ├── useFollows.ts          # Favorites and category follows
│   ├── useGlobalSearch.ts     # Server-side search
│   ├── useSearch.ts           # Client-side Fuse.js search
│   ├── useSearchHistory.ts    # Recent search persistence
│   └── useTranscriptSearch.ts # Debounced transcript full-text search
└── lib/                   # Core libraries
    ├── agenda-item-parser.ts  # Parse CivicClerk agenda text (sponsors, committees)
    ├── agenda-items.ts        # Collect agenda items with attachments
    ├── auth.ts                # NextAuth config
    ├── branding.ts            # Site name and description constants
    ├── breakpoints.ts         # Media queries and touch targets
    ├── committees.ts          # Committee config and slugs
    ├── datetime.ts            # Date/time parsing (Luxon, America/Denver)
    ├── document-chat.ts       # Shared RAG chat handler (used by file and attachment chat routes)
    ├── document-rag.ts        # RAG pipeline: chunking, embeddings, retrieval (TTL-cached)
    ├── document-text.ts       # PDF text extraction and chunking (unpdf)
    ├── file-cache.ts          # Disk-based PDF cache (file-cache/ or /tmp on Vercel)
    ├── notifications.ts       # Daily digest and meeting reminder email logic
    ├── pdf-metadata.ts        # PDF page count extraction via pdf-lib
    ├── pdf-stream.ts          # Disk-cached PDF serving with ETag and Range support
    ├── types.ts               # TypeScript types (e.g. CivicEvent)
    ├── utils.ts               # Utility functions
    ├── zoom-link.ts           # Zoom/Teams/Meet link extraction from PDFs
    ├── civicclerk/            # CivicClerk API client (modular)
    │   ├── index.ts           # Barrel re-exports
    │   ├── agenda-cache.ts    # Cache agenda items to DB (HTML strip, flatten, upsert)
    │   ├── api.ts             # Core API fetch helpers
    │   ├── backfill.ts        # Historical data backfill
    │   ├── cache.ts           # Age-based cache logic
    │   ├── events.ts          # Event fetching and mapping
    │   ├── files.ts           # File URL resolution and metadata
    │   ├── search.ts          # CivicClerk search integration
    │   └── types.ts           # CivicClerk-specific types
    ├── committees/            # Committee-specific logic
    │   ├── links.ts           # Committee external links
    │   ├── scrapers.ts        # Committee member scraping
    │   └── stats.ts           # Committee meeting statistics
    ├── db/                    # Database layer
    │   ├── index.ts           # Drizzle connection
    │   └── schema.ts          # Database schema
    ├── llm/                   # AI/LLM integrations
    │   ├── openrouter.ts      # OpenRouter API client
    │   ├── embeddings.ts      # OpenRouter embeddings for RAG
    │   ├── summary.ts         # Committee summary generation
    │   └── agenda-summary.ts  # Agenda item summary generation
    ├── people/                # People directory data
    │   ├── scrapers.ts        # Elected official scraping (santafenm.gov)
    │   ├── seed.json          # Manual seed data for people
    │   └── sync.ts            # People sync: agendas + scraper + seed → DB
    ├── search/                # Search utilities
    │   └── parse-query.ts     # Google-style query parser for PostgreSQL tsquery
    └── youtube/               # YouTube video & transcript pipeline
        ├── channel.ts         # YouTube Data API v3 client (video discovery)
        ├── matcher.ts         # Fuzzy video-to-event matching (bigram + date scoring)
        ├── pipeline.ts        # End-to-end pipeline orchestrator (cron/backfill)
        ├── transcript.ts      # Transcript extraction (YouTube captions, CivicClerk VTT)
        └── ai-processor.ts   # AI processing (clean, summarize, speakers, topics)
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
3. Add environment variables: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` (production URL), `RESEND_API_KEY`, and `CRON_SECRET` (if using Vercel Cron for `/api/cron/notifications` and `/api/cron/transcripts`). Optionally set `EMAIL_FROM` (requires verified domain in Resend), `OPENROUTER_API_KEY` for AI features (committee summaries, agenda summaries, document chat, transcript processing), and `YOUTUBE_API_KEY` for YouTube video discovery and transcript extraction.
4. Deploy

**Vercel Cron:** The `vercel.json` in this repo only configures the transcript pipeline cron (`/api/cron/transcripts`, every 6 hours). The notifications cron (`/api/cron/notifications`) must be configured separately via the Vercel dashboard or an external cron service if you want daily digest emails.

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
