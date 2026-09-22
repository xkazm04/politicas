/* e-Sbírka SPARQL point-query client (extracted from esbirka-sparql-diff.ts, scan-sweep
 * 2026-09-06). One behaviour fixed: the HTTP status is checked BEFORE the body is trusted. A
 * Virtuoso error answered with a JSON body (a 400 on a malformed FILTER, a 500) used to parse
 * to `bindings: []` and surface as "no fragments found for § … — check the version exists",
 * sending the operator to audit a statute instead of a query. */

export interface SparqlBinding {
  [k: string]: { type: string; value: string };
}

export async function sparqlQuery(
  endpoint: string,
  query: string,
  fetchOne: (url: string) => Promise<Response> = (u) => fetch(u, { headers: { Accept: "application/sparql-results+json" } }),
): Promise<SparqlBinding[]> {
  const url = `${endpoint}?query=${encodeURIComponent(query)}&format=${encodeURIComponent("application/sparql-results+json")}`;
  const res = await fetchOne(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`SPARQL endpoint answered HTTP ${res.status}: ${text.slice(0, 300)}`);
  let json: { results?: { bindings?: SparqlBinding[] } };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`SPARQL endpoint returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  return json.results?.bindings ?? [];
}
