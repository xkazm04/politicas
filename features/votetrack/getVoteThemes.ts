// Server-only: the FIRST real-store read in a feature surface. Joins the
// Silver-layer `vote_tag` dataset (materialized by the benchmarked haiku
// classifier) with the real PSP10 `vote_events` to feed the VoteTrack theme
// filter. Degrades gracefully to null (→ the section is hidden) if no store is
// configured, no tags have been materialized yet, or PGlite is unavailable at
// request time — so introducing the store read can never break the page.
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
import type { VoteThemeData } from "./themeTypes";

export async function getVoteThemes(): Promise<VoteThemeData | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const tags = await readVoteTags();
    if (tags.length === 0) return null;

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

    return { themes, votes, total: votes.length, model: tags[0]?.model ?? null };
  } catch (err) {
    reportLoaderFailure("getVoteThemes", err);
    return null;
  }
}
