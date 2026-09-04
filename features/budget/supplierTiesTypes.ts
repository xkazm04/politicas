// Shared shapes for the live MP↔supplier tie layer of the municipal money trail
// (4D). Plain module (no server imports) so both the server loader
// (getSupplierTies.ts) and the "use client" surfaces can import these.

export interface SupplierTie {
  pspId: number;
  personName: string;
  role: string;
  /** Odmítnuté vazby se vynechávají; vše ostatní bez `verified` je pending. */
  reviewState: "verified" | "pending_review";
}

export interface SupplierTiesResult {
  /** false = sklad nedostupný — „nelze ověřit", NE „žádné vazby". */
  available: boolean;
  /** IČO protistrany → vazby na poslance (jen IČO z generované dávky). */
  ties: Record<string, SupplierTie[]>;
  /** Pass peněžního grafu, ze kterého vrstva čte (provenience plochy). */
  pass: number;
}
