# Timezone wrong on dashboard, correct on details — investigation

## What you're seeing

- **Dashboard (list):** "Community Input Session" → **Fri, Jan 9, 2026 at 1:00 AM** (wrong)
- **Meeting details (same event):** **Thu, Jan 8, 2026 · 6:00 PM** (correct)

So the list and the details page are using different sources of truth for the same event.

---

## Data flow

### Dashboard list (wrong time)

- **Source:** `EventsContext` → `getEventsForMonth()` filters `allEvents`.
- **Where `allEvents` comes from:**
  1. **On load:** `localStorage` key `cityclerk_events_cache_v3` (if present).
  2. **Then:** `GET /api/events?month=YYYY-MM` (with `cache: "no-store"`).
- **API:** [src/app/api/events/route.ts](src/app/api/events/route.ts) always calls `getEventsWithFileCounts(..., { forceRefresh: true })`, which:
  - Fetches from CivicClerk API,
  - Writes parsed `startDateTime` to DB,
  - Returns **parsed** times (after the recent fix).
- So the **only** way the list can show the wrong time is:
  - **Stale `localStorage` cache** from before the fix (old `startDateTime` strings), and/or
  - A **different code path** (e.g. search/category) that reads from the DB (see below).

### Meeting details (correct time)

- **Source:** [src/app/meeting/[id]/page.tsx](src/app/meeting/[id]/page.tsx) calls `getEventById(eventId)`.
- **getEventById** ([src/lib/civicclerk.ts](src/lib/civicclerk.ts)):
  - If **DB cache is fresh** → returns `mapCachedEvent(cachedEvent)` (DB `startDateTime` → `.toISOString()`). So you see whatever is stored in the DB (correct if that row was ever written with `parseEventStartDateTime`).
  - If **DB cache is stale** → fetches CivicClerk API and does **`return response.json()`** with **no parsing**. So in that case the details page would get the **raw API** `startDateTime` (wrong) and would show the wrong time too.

So for the same event to be **wrong on list** and **right on details**, the list must be coming from old cached data (or from DB in a path that has bad data), while for that event the details page is being served from the **DB** with a **correct** `start_date_time` (written at some point with the parser).

---

## Bugs identified

### 1. `getEventById` returns raw API when cache is stale

**File:** [src/lib/civicclerk.ts](src/lib/civicclerk.ts) around line 309.

When the DB cache is not fresh, we do:

```ts
return response.json();
```

So we return the CivicClerk API payload as-is. Their `startDateTime` is “local time with a Z” (e.g. 6 PM Mountain sent as `2026-01-09T01:00:00.000Z` or similar). We never run `parseEventStartDateTime` on it, so the details page would show the wrong time whenever it’s served from the API instead of from the DB.

**Fix:** After `const data = await response.json()`, set `data.startDateTime = parseEventStartDateTime(data.startDateTime).toISOString()` (or equivalent), then return the normalized object instead of raw `response.json()`.

---

### 2. “Trash” from the database

Paths that **read events from the DB** and return them to the client:

- **GET /api/events?eventIds=1,2,3** ([src/app/api/events/route.ts](src/app/api/events/route.ts)) — used by My Follow; reads from `events` and maps with `rowToCivicEvent` (`.startDateTime.toISOString()`).
- **GET /api/events/by-category** ([src/app/api/events/by-category/route.ts](src/app/api/events/by-category/route.ts)) — reads from `events`, maps with `e.startDateTime.toISOString()`.
- **GET /api/search** — uses [src/lib/civicclerk.ts](src/lib/civicclerk.ts) `searchEvents()`: raw SQL, then maps `row.start_date_time` to ISO string.

So any **old rows** that were written **before** we consistently used `parseEventStartDateTime` on write could have a wrong `start_date_time` (e.g. “UTC” that was really local). When we read those and call `.toISOString()`, we send that wrong value to the client, so the UI shows the wrong time. That’s the “trash coming from the database”: not the config, but **legacy rows** with incorrect timestamps.

**Fix options:**

- **One-time correction:** Run a script (e.g. using existing `scripts/refresh-event-times.ts` or similar) that, for events in a given range, fetches raw `startDateTime` from the CivicClerk API and upserts with `parseEventStartDateTime(...)` so the DB has the correct instant. After that, all reads from DB (eventIds, by-category, search, getEventById from cache) will be correct.
- Optionally, add a small “last corrected” or “schema version” so you can re-run correction only for rows that might be old.

---

### 3. Stale client cache (list shows wrong even though API is fixed)

If the list is still wrong after the server-side fix:

- The dashboard list is filled from **localStorage** first (`cityclerk_events_cache_v3`), then updated by `/api/events?month=...`. So old cached events (with wrong `startDateTime`) can show until the next successful fetch and overwrite.
- **Fix:** Clear `cityclerk_events_cache_v3` in DevTools (Application → Local Storage) and reload. For a global rollout, bump the cache key (e.g. to `cityclerk_events_cache_v4`) in [src/context/EventsContext.tsx](src/context/EventsContext.tsx) so all clients drop the old cache.

---

## Why details can be right while list is wrong

- **Details:** For this event, `getEventById` is returning from **DB** (cache considered fresh), and that row has a correct `start_date_time`, so `mapCachedEvent` gives the right ISO string and the UI shows 6:00 PM.
- **List:** The list is either (a) from **localStorage** (old payload with wrong `startDateTime`) or (b) from a path that reads **from the DB** (e.g. search/by-category) where that event came from a **different** row or an old row that was never corrected. So the list shows 1:00 AM.

So the mismatch is explained by: different data sources (context/list vs. getEventById) and/or stale cache and/or uncorrected DB rows.

---

## Recommended actions (in order)

1. **Fix `getEventById`** so that when it fetches from the API it always returns a normalized `startDateTime` (parse with `parseEventStartDateTime` and return ISO). Then details are correct even when cache is stale.
2. **Bump the events cache key** (e.g. `cityclerk_events_cache_v4`) so existing clients don’t keep using old list data.
3. **Run a one-time DB correction** for `start_date_time` (e.g. for last N months) using the CivicClerk API + `parseEventStartDateTime`, so all reads from DB (eventIds, by-category, search, getEventById from cache) are consistent and correct.
4. **Remind users** (or document) that if they still see wrong times on the list, they should hard-refresh or clear site data so the new cache key is used and the new API/DB data is loaded.

After that, both “database configuration” (i.e. what we store and return) and “trash from the database” (legacy wrong rows) are addressed, and the only remaining cause of wrong times would be an old client cache until it’s refreshed or the key is bumped.
