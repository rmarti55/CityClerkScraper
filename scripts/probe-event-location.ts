/**
 * Probe script: fetch one event from CivicClerk API and log venue/location shape.
 * Use to confirm eventLocation structure and flat venue keys for normalizer.
 *
 * Usage:
 *   npx tsx scripts/probe-event-location.ts
 *   npx tsx scripts/probe-event-location.ts 1236
 */
export {};

const API_BASE = "https://santafenm.api.civicclerk.com/v1";

async function main() {
  const eventIdArg = process.argv[2];

  if (eventIdArg) {
    // Single event by ID
    const id = parseInt(eventIdArg, 10);
    if (isNaN(id)) {
      console.error("Invalid event ID");
      process.exit(1);
    }
    const url = `${API_BASE}/Events/${id}`;
    console.log(`Fetching single event ${id}...\n`);
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      console.error("API error:", response.status, await response.text());
      process.exit(1);
    }
    const e = await response.json();
    logEventShape(e, `Event ${id}`);
    return;
  }

  // List: get first event from a date range
  const startDate = "2026-02-01";
  const endDate = "2026-02-28";
  const filter = `startDateTime ge ${startDate} and startDateTime lt ${endDate}`;
  const url = `${API_BASE}/Events?$filter=${encodeURIComponent(filter)}&$orderby=startDateTime asc&$top=1`;

  console.log(`Fetching first event in ${startDate}..${endDate}...\n`);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    console.error("API error:", response.status, await response.text());
    process.exit(1);
  }

  const data = await response.json();
  const events = data.value ?? [];
  if (events.length === 0) {
    console.log("No events in range.");
    return;
  }

  logEventShape(events[0], (events[0] as { eventName?: string }).eventName ?? "First event");
}

function logEventShape(e: Record<string, unknown>, label: string) {
  console.log("--- Top-level keys ---");
  console.log(Object.keys(e).sort().join(", "));

  const venueKeys = ["venueName", "venueAddress", "venueCity", "venueState", "venueZip"];
  console.log("\n--- Flat venue fields ---");
  for (const k of venueKeys) {
    const v = (e as Record<string, unknown>)[k];
    console.log(`  ${k}: ${v === undefined ? "(undefined)" : JSON.stringify(v)}`);
  }

  const loc = e.eventLocation as Record<string, unknown> | undefined;
  console.log("\n--- eventLocation ---");
  if (loc == null) {
    console.log("  (absent or null)");
  } else {
    console.log("  keys:", Object.keys(loc).join(", "));
    for (const [k, v] of Object.entries(loc)) {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
