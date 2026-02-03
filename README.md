# Santa Fe Civic Dashboard

A clean, usable interface for browsing Santa Fe city council meetings, agendas, and public documents.

Built because the official CivicClerk portal is terrible.

## Features

- **Monthly calendar view** - see all meetings at a glance
- **Activity badges** - instantly see which meetings have attachments, agendas, minutes
- **Meeting detail pages** - view all files, preview PDFs inline
- **Fast** - built with Next.js and server components

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

That's it. No API keys or tokens needed - the CivicClerk API is publicly accessible.

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Deploy

No environment variables needed.

## Tech Stack

- [Next.js 14](https://nextjs.org/) with App Router
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)

## API Reference

The CivicClerk API uses OData-style endpoints (publicly accessible):

| Purpose | Endpoint |
|---------|----------|
| List events | `GET /v1/Events?$filter=startDateTime ge {date}` |
| Single event | `GET /v1/Events({id})` |
| Event files | `GET /v1/Events({id})/Files` |
| Download file | `GET /v1/Files({fileId})/$value` |

Base URL: `https://santafenm.api.civicclerk.com`

## Legal Note

This tool accesses public records via public API endpoints. It's civic homework, not vandalism.

- Don't flood the API (requests are cached for 5 minutes)
- All meeting data is public record
