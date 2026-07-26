"use client";

/*
 * Výběr uzlu + dotažení jeho detailu.
 *
 * Detail se NAČÍTÁ V OBSLUZE UDÁLOSTI, ne v efektu. Výběr vždycky pochází
 * z akce člověka (klik do plátna, řádek v seznamu, položka z našeptávače),
 * takže efekt by tu byl jen oklika — a `setState` synchronně v těle efektu
 * navíc zakazuje react-hooks/set-state-in-effect.
 *
 * Závod odpovědí hlídá počítadlo: když čtenář proklikne tři uzly rychle za
 * sebou, pomalá první odpověď nesmí přepsat detail toho třetího.
 */

import { useCallback, useRef, useState } from "react";
import { nodeDetailAction } from "./graphActions";
import type { NodeDetail } from "./graphTypes";

export interface NodeSelection {
  selectedId: string | null;
  detail: NodeDetail | null;
  loading: boolean;
  select: (id: string | null) => void;
  clear: () => void;
}

export function useNodeSelection(): NodeSelection {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    const req = ++reqRef.current;
    if (!id) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void nodeDetailAction(id).then((d) => {
      if (reqRef.current !== req) return;
      setDetail(d);
      setLoading(false);
    });
  }, []);

  const clear = useCallback(() => select(null), [select]);

  return { selectedId, detail, loading, select, clear };
}
