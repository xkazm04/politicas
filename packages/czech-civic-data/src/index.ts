// czech-civic-data — the normalization layer for reading Czech civic open
// data correctly: escape-aware Informix UNL parsing, fatal windows-1250
// decoding, a dependency-free capped ZIP reader, Czech ASCII folding, and the
// documented psp.cz roll-call vocabularies (including the post-1995 "K merges
// abstain/not-voting" footgun).
//
// Doctrine: missing beats wrong. Every parser in this package returns null or
// throws a named error rather than guessing — see README.md (CZ + EN).
export * from "./normalize";
export * from "./unl";
export * from "./zip";
