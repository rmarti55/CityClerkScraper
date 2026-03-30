// Functions — events
export {
  getEvents,
  getEventById,
  getEventsWithFileCounts,
  refreshEventById,
  fetchEventNameFromAPI,
  fetchEventStartDateTimeFromAPI,
} from './events';

// Functions — files
export {
  getEventFiles,
  getFileDownloadUrl,
  getFileUrl,
  getAttachmentFreshUrl,
} from './files';

// Functions — API (meeting details)
export { getMeetingDetails } from './api';

// Functions — search
export { searchCivicClerk, searchDocumentsLocal, searchEvents } from './search';

// Functions — backfill
export { backfillDateRange } from './backfill';
export type { BackfillResult } from './backfill';

// Re-export types for backward compatibility
export type {
  CivicEvent,
  CivicFile,
  MeetingDetails,
  MeetingItem,
  ItemAttachment,
  DocumentSearchResult,
  MatchingFile,
  MatchingItem,
} from '../types';

// Re-export format helpers for backward compatibility
export { formatEventDate, formatEventTime } from '../utils';
