# Santa Fe Civic Dashboard

A clean, usable interface for browsing Santa Fe city council meetings, agendas, and public documents.

Built because the official CivicClerk portal is terrible.

## Features

- **Monthly calendar view** - see all meetings at a glance
- **Activity badges** - instantly see which meetings have attachments, agendas, minutes
- **Meeting detail pages** - view all files, preview PDFs inline
- **Fast** - built with Next.js and server components

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Get your CivicClerk token

1. Open https://santafenm.portal.civicclerk.com/
2. Open DevTools (F12) → Network tab → Fetch/XHR filter
3. Click around on the site (Meetings, any meeting)
4. Find any request to `santafenm.api.civicclerk.com`
5. In the Headers tab, copy the `Authorization: Bearer eyJ...` value

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and paste your token:

```env
CIVICCLERK_TOKEN=eyJhbGciOi...your_full_token_here
```

### 4. Run development server

```bash
npm run dev
```

Open http://localhost:3000

## Deployment (Vercel)

### Manual deployment

1. Push to GitHub
2. Import project in Vercel
3. Add `CIVICCLERK_TOKEN` environment variable in Vercel project settings
4. Deploy

### Automatic token refresh

Tokens expire after ~8 hours. This repo includes a GitHub Action that automatically refreshes the token every 4 hours.

#### Setup (one-time)

1. **Get Vercel credentials:**
   - Go to https://vercel.com/account/tokens → Create token
   - Go to your Vercel project → Settings → General → copy Project ID
   - Go to https://vercel.com/account → copy your Org ID (or Team ID)

2. **Add GitHub secrets:**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `VERCEL_TOKEN` - your Vercel API token
     - `VERCEL_PROJECT_ID` - your project ID
     - `VERCEL_ORG_ID` - your org/team ID

The GitHub Action runs every 4 hours and:
1. Uses Playwright to log into CivicClerk portal
2. Captures the Bearer token from network requests
3. Updates the Vercel environment variable
4. Triggers a redeploy

## Tech Stack

- [Next.js 14](https://nextjs.org/) with App Router
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)

## API Reference

The CivicClerk API uses OData-style endpoints:

| Purpose | Endpoint |
|---------|----------|
| List events | `GET /v1/Events?$filter=startDateTime ge {date}` |
| Single event | `GET /v1/Events({id})` |
| Event files | `GET /v1/Events({id})/Files` |
| Download file | `GET /v1/Files({fileId})/$value` |

All requests require `Authorization: Bearer {token}` header.

## Legal Note

This tool accesses public records via public API endpoints. It's civic homework, not vandalism.

- Don't flood the API (requests are cached for 5 minutes)
- Cache results locally when possible
- All meeting data is public record
