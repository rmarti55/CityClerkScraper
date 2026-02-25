# CivicClerk API – Endpoints We Use vs What Exists

**Base URL:** `https://santafenm.api.civicclerk.com/v1`  
**Discovery:** `GET /v1/` returns EntitySets; `GET /v1/$metadata` returns OData schema (XML).

---

## Entity sets (from `GET /v1/`)

| EntitySet       | We use? | Notes |
|-----------------|--------|--------|
| Events          | Yes    | List by date filter, single by id. **Single Event includes `publishedFiles` – we do not use it.** |
| Meetings        | Yes    | We call `Meetings(agendaId)` for files only. Returns 404 for some agendaIds (e.g. 718) while `Events/1236` has those files. |
| EventCategories | Yes    | Categories list. |
| EventTemplate   | No     | Template metadata. |
| EventsMedia     | No     | Video/stream, captions, bookmarks. |
| Search          | No     | Full-text style search; returns empty without known query shape. |
| Sections        | No     | Agenda sections by agendaId; returned empty in probe. |
| Settings        | No     | Custom portal labels (agenda tab, minutes text, etc.). |
| Subscriptions   | No     | Subscription options (label, isCheck). |
| Emails          | No     | Email/send actions; not for reading content. |

---

## Critical gap: files

- **We only load files from** `GET /v1/Meetings(agendaId)`. For some events (e.g. Solid Waste, agendaId 718) that returns **404**.
- **Same meeting’s event** from `GET /v1/Events/{id}` includes **`publishedFiles`** (e.g. Agenda, Agenda Packet) with same shape (fileId, name, type, url, publishOn, fileType).
- **Fix:** When `getMeetingDetails(agendaId)` returns null, use `event.publishedFiles` from the Event response (we already fetch Event; we just don’t use this field).

README mentions `GET /v1/Events({id})/Files`; probed `Events/1236/Files` → **404**. So the “Event files” endpoint in the README is either wrong or uses a different URL; the reliable source for files on the event is **`publishedFiles` on the Event entity**.

---

## Other endpoints / fields we don’t use

### Events (single) – extra fields

- **publishedFiles** – File list (we ignore; should use when Meeting 404s).
- **publishedAgendaTimeStamp** – e.g. `"Agenda Posted on February 13, 2026 2:23 PM"`.
- **eventNotice**, **showEventNoticePreview** – Notice text and preview flag.
- **agendaFile**, **minutesFile** – Legacy file info (fileName, dateUploaded, createdBy).
- **hasMedia**, **externalMediaUrl** – Video/stream; we don’t show.
- **eventLocation** – We already map address from event; API nests it here too.

### Events – bound functions (OData)

- **GetEventFile(fileId, fileType)** – Returns file bytes. We use `Meetings/GetMeetingFile` instead; Event’s `publishedFiles[].url` already points to Meetings URL.
- **GetEventFileStream(fileId, fileType, plainText)** – Stream variant.
- **GetEventMediaSummary(eventId)** – On EventsMedia collection; media status.
- **GetPastTwoAndFutureEvents** – Custom function on Events collection (not probed).

### Meetings – bound functions

- **GetMeetingFile(fileId, plainText)** – We use this for download/stream.
- **GetMeetingFileStream(fileId, plainText)** – We use this.
- **GetAttachmentFile(fileId)** – Alternative for attachments; not used.
- **GetMeetingItemMinutesVotes(id)** – Votes per agenda item; we don’t show.

### EventsMedia

- **videoUrl**, **externalVideoUrl**, **transcriptionUrl**, **closedCaptionUrl**, **eventBookmarks**, **pauseMessage**, **audioDescriptionUrl**.
- Would allow showing “Watch video” / “View transcript” when `hasMedia` is true.

### Search

- **PublicSearchResultModel:** event (with publishedFiles), agenda, agendaFiles, attachments, items, videoTimestamps, closedCaptions.
- GET `/v1/Search` with no params returns `value: []`. Likely needs a search term or filter; exact contract not confirmed.

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

1. **Must fix:** Use **Event.publishedFiles** when `Meetings(agendaId)` 404s (or always merge Event + Meeting file lists so we show all files).
2. **Worth considering:**  
   - **publishedAgendaTimeStamp** and **eventNotice** on Event for context.  
   - **EventsMedia** (or Event’s **hasMedia** / **externalMediaUrl**) to show video/stream links.  
   - **Meeting.items** (or **Sections** if we get them working) for agenda items when there are no files.  
   - **Settings** for customizable labels.
3. **README correction:** `GET /v1/Events({id})/Files` is not the way we get files; the Event entity’s **publishedFiles** property is. Update README to mention Event.publishedFiles and the fallback when Meetings 404.
