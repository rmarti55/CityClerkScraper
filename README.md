# Santa Fe Civic Dashboard

A clean, usable interface for browsing Santa Fe city council meetings, agendas, and public documents.

Built because the official CivicClerk portal is terrible.

## Features

- **Monthly calendar view** - Browse meetings by month with easy navigation
- **Category filtering** - Filter meetings by category (City Council, Planning Commission, etc.)
- **Global search** - Server-side search across all meetings with pagination
- **Client-side search** - Fast fuzzy search within the current month using Fuse.js
- **Search history** - Recent searches saved locally for quick access
- **Meeting detail pages** - View full meeting info with all attached files
- **PDF preview** - View PDFs inline or download files
- **File metadata** - See file sizes and PDF page counts before downloading
- **Sticky header** - Quick access to search and navigation while scrolling
- **URL-synced search** - Search state persists in URL for sharing
- **Activity badges** - See file counts, "Upcoming" status, and "Has Agenda" at a glance
- **Database caching** - Age-based caching for fast performance
- **Historical data** - Backfill utility to import 5 years of meeting history
- **Loading skeletons** - Smooth loading states throughout the UI

## Tech Stack

- [Next.js 16.1.6](https://nextjs.org/) with App Router
- [React 19.2.3](https://react.dev/)
- [TypeScript 5](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Drizzle ORM 0.45.1](https://orm.drizzle.team/)
- [Neon Serverless PostgreSQL](https://neon.tech/)
- [Fuse.js 7.1.0](https://www.fusejs.io/) for client-side fuzzy search
- [pdf-lib 1.17.1](https://pdf-lib.js.org/) for PDF metadata extraction

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

Create a `.env` or `.env.local` file in the project root:

```bash
# Required: PostgreSQL connection string (Neon recommended)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

See `.env.example` for a template.

**Note:** The CivicClerk API is publicly accessible - no API key needed.

## Database Setup

This project uses PostgreSQL (via Neon) with Drizzle ORM.

1. Create a database on [Neon](https://neon.tech/) (free tier available)
2. Copy the connection string to your `.env` file
3. Run migrations:

```bash
npx drizzle-kit push
```

4. (Optional) Backfill historical data:

```bash
npm run backfill        # Full 5-year backfill
npm run backfill:probe  # Test with 1 month first
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run backfill` | Backfill 5 years of historical meeting data |
| `npm run backfill:probe` | Test backfill with first month only |

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
│   │   ├── categories/    # GET event categories
│   │   ├── events/        # GET all cached events
│   │   │   └── by-category/  # Filter by category
│   │   ├── file/[id]/     # File proxy with caching
│   │   │   └── metadata/  # File size & page count
│   │   └── search/        # Server-side search
│   ├── meeting/[id]/      # Meeting detail page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── skeletons/        # Loading skeleton components
│   ├── CategoryFilter.tsx    # Category dropdown filter
│   ├── CategoryFilterResults.tsx  # Filtered results display
│   ├── FileMetadata.tsx  # File size & page count display
│   ├── HomePage.tsx      # Main home page
│   ├── MeetingCard.tsx   # Meeting card display
│   ├── MeetingList.tsx   # Meeting list with grouping
│   ├── MonthPicker.tsx   # Month/year navigation
│   ├── SearchBar.tsx     # Search input
│   ├── StickyHeader.tsx  # Sticky header on scroll
│   └── ...
├── context/              # React context providers
│   └── EventsContext.tsx # Global events state
├── hooks/                # Custom React hooks
│   ├── useCategories.ts  # Fetch & cache categories
│   ├── useCategoryFilter.ts  # Category filtering with pagination
│   ├── useGlobalSearch.ts    # Server-side search
│   ├── useSearch.ts      # Client-side Fuse.js search
│   └── useSearchHistory.ts   # Recent search persistence
└── lib/                  # Core libraries
    ├── civicclerk.ts     # API client & caching logic
    ├── types.ts          # TypeScript types
    ├── utils.ts          # Utility functions
    └── db/               # Database layer
        ├── index.ts      # Drizzle connection
        └── schema.ts     # Database schema
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
3. Add environment variable: `DATABASE_URL`
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
