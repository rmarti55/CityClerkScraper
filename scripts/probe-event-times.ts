/**
 * Probe script: fetch events from CivicClerk API for a date and log raw startDateTime.
 * Use to investigate anomalies (e.g. "2:00 AM" when it should be 2:00 PM).
 * No DATABASE_URL required.
 *
 * Usage:
 *   npx tsx scripts/probe-event-times.ts 2026-02-11
 *   npx tsx scripts/probe-event-times.ts 2026-02-11 2026-02-12
 */
export {};

const API_BASE = "https://santafenm.api.civicclerk.com/v1";

async function main() {
  const startArg = process.argv[2] ?? "2026-02-11";
  const endArg = process.argv[3] ?? "2026-02-12";

  const startDate = startArg;
  const endDate = endArg;

  const filter = `startDateTime ge ${startDate} and startDateTime lt ${endDate}`;
  const url = `${API_BASE}/Events?$filter=${encodeURIComponent(filter)}&$orderby=startDateTime asc&$count=true`;

  console.log(`Fetching events from API: ${startDate} to ${endDate}\n`);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    console.error("API error:", response.status, await response.text());
    process.exit(1);
  }

  const data = await response.json();
  const events = data.value ?? [];

  console.log(`Found ${events.length} event(s). Raw startDateTime from API:\n`);
  for (const e of events) {
    const name = e.eventName ?? e.name ?? "(no name)";
    const raw = e.startDateTime ?? "(missing)";
    console.log(`  "${name}"`);
    console.log(`    startDateTime (raw): ${JSON.stringify(raw)}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
