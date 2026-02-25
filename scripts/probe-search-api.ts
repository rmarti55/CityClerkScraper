/**
 * Probe Civic Clerk Search API to discover query parameters and response shape.
 * No DATABASE_URL required.
 *
 * Usage:
 *   npx tsx scripts/probe-search-api.ts
 *   npx tsx scripts/probe-search-api.ts bicycle
 */
export {};

const API_BASE = "https://santafenm.api.civicclerk.com/v1";

async function probe(
  label: string,
  url: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  let data: unknown;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const query = process.argv[2] ?? "bicycle";

  console.log("=== 1. GET /v1/Search (no params) ===\n");
  const noParams = await probe(
    "Search no params",
    `${API_BASE}/Search`
  );
  console.log("Status:", noParams.status);
  console.log("Response:", JSON.stringify(noParams.data, null, 2).slice(0, 800));
  console.log("\n");

  console.log("=== 2. GET /v1/Search?search=<query> ===\n");
  const searchParam = await probe(
    "Search with search=",
    `${API_BASE}/Search?${new URLSearchParams({ search: query })}`
  );
  console.log("Status:", searchParam.status);
  console.log("Response:", JSON.stringify(searchParam.data, null, 2).slice(0, 2000));
  console.log("\n");

  console.log("=== 3. GET /v1/Search?q=<query> ===\n");
  const qParam = await probe(
    "Search with q=",
    `${API_BASE}/Search?${new URLSearchParams({ q: query })}`
  );
  console.log("Status:", qParam.status);
  console.log("Response:", JSON.stringify(qParam.data, null, 2).slice(0, 2000));
  console.log("\n");

  console.log("=== 4. GET /v1/Search?$filter=... (OData) ===\n");
  const filterParam = await probe(
    "Search with $filter",
    `${API_BASE}/Search?$filter=search(query='${encodeURIComponent(query)}')`
  );
  console.log("Status:", filterParam.status);
  console.log("Response:", JSON.stringify(filterParam.data, null, 2).slice(0, 1500));
  console.log("\n");

  console.log("=== 5. GET /v1/$metadata (Search entity) ===\n");
  const metaRes = await fetch(`${API_BASE}/$metadata`, {
    headers: { Accept: "application/xml" },
  });
  const metaText = await metaRes.text();
  const searchIdx = metaText.indexOf("Search");
  const searchSnippet = searchIdx >= 0
    ? metaText.slice(Math.max(0, searchIdx - 100), searchIdx + 600)
    : "(no 'Search' found in metadata)";
  console.log("Search-related metadata snippet:");
  console.log(searchSnippet);
  console.log("\n");

  // If any Search response had value array, report length
  const withValue = [noParams, searchParam, qParam, filterParam].find(
    (r) => r.data && typeof r.data === "object" && "value" in r.data && Array.isArray((r.data as { value: unknown }).value)
  );
  if (withValue && withValue.data && typeof withValue.data === "object" && "value" in withValue.data) {
    const value = (withValue.data as { value: unknown[] }).value;
    console.log("=== Summary: Search returned value.length =", value.length, "===");
    if (value.length > 0) {
      console.log("First result keys:", Object.keys(value[0] ?? {}));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
