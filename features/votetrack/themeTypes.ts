// Shared shapes for the VoteTrack theme filter — the first surface fed by REAL
// store data (the Silver-layer `vote_tag` dataset) rather than the lib/civic mock.
// Plain module (no server imports) so both the server fetch and the client
// component can import these.

export interface ThemeCount {
  slug: string;
  count: number;
}

export interface TaggedVote {
  votePspId: number;
  title: string;
  outcome: string; // "accepted" | "rejected" | …
  votedOn: string | null;
  theme: string;
}

export interface VoteThemeData {
  themes: ThemeCount[];
  votes: TaggedVote[];
  total: number;
  /** The model that produced the tags (cited in the SourceNote). */
  model: string | null;
}
