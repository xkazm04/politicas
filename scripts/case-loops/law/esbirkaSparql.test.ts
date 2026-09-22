import { describe, expect, it } from "vitest";
import { sparqlQuery } from "./esbirkaSparql";

describe("sparqlQuery — an HTTP error is an error even when its body parses as JSON", () => {
  it("returns bindings on 200", async () => {
    const rows = await sparqlQuery("https://sparql.test", "SELECT * WHERE {}", async () =>
      new Response(JSON.stringify({ results: { bindings: [{ p: { type: "uri", value: "x" } }] } }), { status: 200 }),
    );
    expect(rows).toEqual([{ p: { type: "uri", value: "x" } }]);
  });

  it("throws naming the status on a 400 with a JSON body (was read as 'no fragments')", async () => {
    await expect(
      sparqlQuery("https://sparql.test", "SELECT", async () => new Response(JSON.stringify({ error: "bad query" }), { status: 400 })),
    ).rejects.toThrow(/HTTP 400/);
  });

  it("throws on a non-JSON body, quoting its head", async () => {
    await expect(
      sparqlQuery("https://sparql.test", "SELECT", async () => new Response("<html>Virtuoso error</html>", { status: 200 })),
    ).rejects.toThrow(/non-JSON/);
  });

  it("sends the query URL-encoded with the JSON results format", async () => {
    let url = "";
    await sparqlQuery("https://sparql.test", "SELECT ?a WHERE { ?a ?b ?c }", async (u) => {
      url = u;
      return new Response(JSON.stringify({ results: { bindings: [] } }));
    });
    expect(url).toContain("https://sparql.test?query=SELECT%20%3Fa");
    expect(url).toContain("format=application%2Fsparql-results%2Bjson");
  });
});
