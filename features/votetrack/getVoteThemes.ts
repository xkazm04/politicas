// Server-only: the FIRST real-store read in a feature surface. Joins the
// Silver-layer `vote_tag` dataset (materialized by the benchmarked haiku
// classifier) with the real PSP10 `vote_events` to feed the VoteTrack theme
// filter. Degrades gracefully to null if no store is configured or PGlite is
// unavailable at request time — so introducing the store read can never break
// the page.
//
// TŘI STAVY OD 2026-08-12 (silverLayer.ts): `null` znamená VÝPADEK, zatímco
// úspěšné čtení prázdné vrstvy vrací `{ state: "never-computed" }` a /hlasovani
// pro něj má vlastní větu. Do té doby obojí končilo `null` a sekce se mlčky
// schovala — přestože rail (`PAGE_SECTIONS["/hlasovani"]`) na kotvu `#temata`
// odkazoval pořád, takže odkaz vedl do prázdna.
//
// Called only from the /hlasovani server component; the `server-only` import
// makes any client-component import a build-time error. (The runtime client
// guard lives in lib/db/pglite-store.ts, not getStore() itself.)
//
// 2026-08-10: the tag and event reads moved to ledgerRead.ts, where they are
// `react.cache()`d — /hlasovani awaits getVoteRecord() and getVoteThemes() in the
// same render, and both wanted the same `vote_event` relation. The ad-hoc 100 000
// limits went with them: a limit BELOW the row count is a silent truncation, and a
// small one makes PGlite walk the primary key instead of the index (CLAUDE.md,
// /zebricek 2026-08-04). One cap for the whole app: `KG_READ_CAP`.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { readVoteEvents, readVoteTags } from "./ledgerRead";
import { SILVER_NEVER_COMPUTED, silverReady, type SilverLayerRead } from "./silverLayer";
import type { VoteThemeData } from "./themeTypes";

export async function getVoteThemes(): Promise<SilverLayerRead<VoteThemeData> | null> {
  try {
    // Pořadí je součást tvrzení: bez store se NIC nepřečetlo (výpadek), kdežto
    // prázdné pole PO úspěšném čtení znamená, že se vrstva nikdy nespočítala.
    const store = await getStore();
    if (!store) return null;
    const tags = await readVoteTags();
    if (tags.length === 0) return SILVER_NEVER_COMPUTED;

    const counts = await store.voteTagCountsByTheme();
    const events = await readVoteEvents();
    const byId = new Map(events.map((e) => [e.pspId, e]));

    const votes = tags
      .map((tag) => {
        const e = byId.get(tag.votePspId);
        const title = (e?.titleLong ?? e?.titleShort ?? e?.titleNorm ?? "").trim();
        return {
          votePspId: tag.votePspId,
          title: title || `#${tag.votePspId}`,
          outcome: e?.outcome ?? "",
          votedOn: e?.votedOn ?? null,
          theme: tag.theme,
        };
      })
      // newest first (RFC3339 dates sort lexicographically)
      .sort((a, b) => (b.votedOn ?? "").localeCompare(a.votedOn ?? ""));

    const themes = Object.entries(counts)
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count);

    return silverReady({ themes, votes, total: votes.length, model: tags[0]?.model ?? null });
  } catch (err) {
    reportLoaderFailure("getVoteThemes", err);
    return null;
  }
}
