// Server-only: the FIRST real-store read in a feature surface. Joins the
// Silver-layer `vote_tag` dataset (materialized by the benchmarked haiku
// classifier) with the real PSP10 `vote_events` to feed the VoteTrack theme
// filter. Degrades gracefully to null (→ the section is hidden) if no store is
// configured, no tags have been materialized yet, or PGlite is unavailable at
// request time — so introducing the store read can never break the page.
//
// Called only from the /hlasovani server component; getStore() carries its own
// client guard, so this must never be imported into a client component.

import { getStore } from "@/lib/db/store";
import type { VoteThemeData } from "./themeTypes";

export async function getVoteThemes(): Promise<VoteThemeData | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const tags = await store.listVoteTags({ limit: 100_000 });
    if (tags.length === 0) return null;

    const counts = await store.voteTagCountsByTheme();
    const events = await store.listVoteEvents({ termCode: "PSP10", limit: 100_000 });
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
  } catch {
    return null;
  }
}
