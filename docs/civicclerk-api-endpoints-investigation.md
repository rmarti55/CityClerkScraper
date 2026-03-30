# CivicClerk API – Endpoints We Use vs What Exists

**Base URL:** `https://santafenm.api.civicclerk.com/v1`  
**Discovery:** `GET /v1/` returns EntitySets; `GET /v1/$metadata` returns OData schema (XML).

---

## Entity sets (from `GET /v1/`)

| EntitySet       | We use? | Notes |
|-----------------|--------|--------|
| Events          | Yes    | List by date filter, single by id. **Single Event includes `publishedFiles` — used as fallback when Meetings 404s.** |
| Meetings        | Yes    | We call `Meetings(agendaId)` for files. Returns 404 for some agendaIds; app falls back to Event.publishedFiles. |
| EventCategories | Yes    | Categories list. |
| EventTemplate   | No     | Template metadata. |
| EventsMedia     | No     | Video/stream, captions, bookmarks. |
| Search          | Yes    | GET /v1/Search?search=query — full-text; we use for document search. |
| Sections        | No     | Agenda sections by agendaId; returned empty in probe. |
| Settings        | No     | Custom portal labels (agenda tab, minutes text, etc.). |
| Subscriptions   | No     | Subscription options (label, isCheck). |
| Emails          | No     | Email/send actions; not for reading content. |

---

## Files: Meetings vs Event.publishedFiles (resolved)

- **Primary source:** `GET /v1/Meetings(agendaId)` for files. Returns 404 for some agendaIds (e.g. 718).
- **Fallback:** `GET /v1/Events/{id}` includes **`publishedFiles`** (same shape: fileId, name, type, url, publishOn, fileType). The app now uses this as fallback when Meetings returns 404 — see `src/lib/civicclerk/files.ts`.
- `GET /v1/Events({id})/Files` returns **404** and is not a valid endpoint; the reliable source is the **`publishedFiles`** property on the Event entity.

---

## Other endpoints / fields we don't use

### Events (single) – extra fields

- **publishedFiles** – File list (used as fallback when Meetings returns 404).
- **publishedAgendaTimeStamp** – e.g. `"Agenda Posted on February 13, 2026 2:23 PM"`.
- **eventNotice**, **showEventNoticePreview** – Notice text and preview flag.
- **agendaFile**, **minutesFile** – Legacy file info (fileName, dateUploaded, createdBy).
- **hasMedia**, **externalMediaUrl** – Video/stream; we don't show.
- **eventLocation** – We already map address from event; API nests it here too.

### Events – bound functions (OData)

- **GetEventFile(fileId, fileType)** – Returns file bytes. We use `Meetings/GetMeetingFile` instead; Event's `publishedFiles[].url` already points to Meetings URL.
- **GetEventFileStream(fileId, fileType, plainText)** – Stream variant.
- **GetEventMediaSummary(eventId)** – On EventsMedia collection; media status.
- **GetPastTwoAndFutureEvents** – Custom function on Events collection (not probed).

### Meetings – bound functions

- **GetMeetingFile(fileId, plainText)** – We use this for download/stream.
- **GetMeetingFileStream(fileId, plainText)** – We use this.
- **GetAttachmentFile(fileId)** – Alternative for attachments; not used.
- **GetMeetingItemMinutesVotes(id)** – Votes per agenda item; we don't show.

### EventsMedia

- **videoUrl**, **externalVideoUrl**, **transcriptionUrl**, **closedCaptionUrl**, **eventBookmarks**, **pauseMessage**, **audioDescriptionUrl**.
- Would allow showing "Watch video" / "View transcript" when `hasMedia` is true.

### Search

- **PublicSearchResultModel:** event (with publishedFiles), agenda, agendaFiles, attachments, items, videoTimestamps, closedCaptions.
- **Query contract (confirmed):** `GET /v1/Search?search=<query>` returns full-text results. No params or `?q=` returns `value: []`. OData `$filter=search(...)` is not supported.
- **Response:** Each result has `event` (with optional `publishedFiles`), `agendaFiles`, `attachments`, `items`. Names and content use `<mark class="highlight">...</mark>` for matches. `agendaFiles`/items can include `fileContent` (array of highlighted snippets). Event has `meetingDate`, `categoryName`, `eventLocation`; use event `id` to link to meeting page.
- **We use it:** Yes — `searchCivicClerk(query)` and `/api/search/documents` call this for meeting-document search.

### Sections

- **SectionModel:** agendaId, sectionName, agendaObjectItemName, agendaObjectItemDescription, etc.
- GET `/v1/Sections?$top=5` returned empty; may require `$filter=agendaId eq 718` or similar.

### Settings

- **SettingsModel:** agendaTabTitle, agendaItemsTabLabel, minutesText, noticeFileLabel, otherFileLabel, options (showDownload, defaultPageView).
- Could drive UI labels instead of hardcoding.

### EventTemplate

- Template name, description, location, recurrence, etc. Low value for public meeting display.

### Subscriptions

- **SubscriptionsModel:** id, label, isCheck. Likely for email/notification signup options.

---

## Summary

1. **Fixed:** The app now uses **Event.publishedFiles** as fallback when `Meetings(agendaId)` returns 404. See `src/lib/civicclerk/files.ts`.
2. **Implemented since investigation:**
   - ~~**EventsMedia** (or Event's **hasMedia** / **externalMediaUrl**) to show video/stream links.~~ **Done** — video/stream links are now provided via the YouTube pipeline (`src/lib/youtube/`), which discovers videos from the city's YouTube channel and matches them to events. The CivicClerk `EventsMedia` entity is not used; the feature was implemented through a different, more reliable approach.
   - ~~**Meeting.items** (or **Sections** if we get them working) for agenda items when there are no files.~~ **Done** — agenda items are now parsed from `Meeting.items`, cached to the `agenda_items` DB table (`src/lib/civicclerk/agenda-cache.ts`), parsed for sponsors and committee review schedule (`src/lib/agenda-item-parser.ts`), and displayed in the UI (`src/components/AgendaItemsList.tsx`).
3. **Still worth considering:**
   - **publishedAgendaTimeStamp** and **eventNotice** on Event for context.
   - **Settings** for customizable labels.
4. **Fixed:** README now correctly documents the Event.publishedFiles fallback instead of the non-existent `Events({id})/Files` endpoint.
