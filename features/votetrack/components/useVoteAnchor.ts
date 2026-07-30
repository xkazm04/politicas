"use client";

/**
 * Per-vote permalink behaviour for the real ledger: on load (and on hashchange)
 * a `#h-<pspId>` fragment selects the vote, scrolls its ledger row into view
 * (instant under prefers-reduced-motion, smooth otherwise) and highlights it for
 * a moment; selecting a vote writes the fragment back with replaceState so the
 * address bar is always a shareable permalink. Pure id logic lives in
 * record/anchor.ts (tested); this hook is only the DOM choreography.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { parseVoteAnchor, voteAnchorId } from "../record/anchor";

const HIGHLIGHT_MS = 2600;

export function useVoteAnchor(ledgerIds: readonly number[], onSelect: (votePspId: number) => void) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs so the hash listener never goes stale without re-subscribing;
  // synced in an effect (react-hooks/refs forbids ref writes during render).
  const idsRef = useRef(ledgerIds);
  const onSelectRef = useRef(onSelect);
  const reduceRef = useRef(reduceMotion);
  useEffect(() => {
    idsRef.current = ledgerIds;
    onSelectRef.current = onSelect;
    reduceRef.current = reduceMotion;
  }, [ledgerIds, onSelect, reduceMotion]);

  const focusVote = useCallback((id: number) => {
    if (!idsRef.current.includes(id)) return;
    onSelectRef.current(id);
    setHighlighted(id);
    // Wait a frame so the selected row exists/updates before scrolling.
    requestAnimationFrame(() => {
      document
        .getElementById(voteAnchorId(id))
        ?.scrollIntoView({ behavior: reduceRef.current ? "auto" : "smooth", block: "center" });
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
  }, []);

  const applyHash = useCallback(() => {
    const id = parseVoteAnchor(window.location.hash);
    if (id !== null) focusVote(id);
  }, [focusVote]);

  useEffect(() => {
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [applyHash]);

  /** Selecting a vote makes the URL its permalink — without scrolling the page. */
  const setAnchor = useCallback((votePspId: number) => {
    history.replaceState(null, "", `#${voteAnchorId(votePspId)}`);
  }, []);

  /** Cross-section jump (seismograf / matice / kronika → deník): permalink,
   * select, scroll and flash in one move. */
  const jumpTo = useCallback(
    (votePspId: number) => {
      setAnchor(votePspId);
      focusVote(votePspId);
    },
    [setAnchor, focusVote],
  );

  return { highlighted, setAnchor, jumpTo };
}
