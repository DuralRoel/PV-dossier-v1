import type { Rail } from "./types";

export type RailStockSettings = {
  stockLength_m: number;   // 6.0
  minReusable_m: number;   // bv 2.0
};

export type RailStockResult = {
  totalRail_m: number;
  stockPieces: number;
  stockTotal_m: number;
  scrap_m: number;
  reusableOffcuts_m: number;
};

function railLen(r: Rail) {
  return Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
}

export function calcRailStock(rails: Rail[], settings: RailStockSettings): RailStockResult {
  const L = settings.stockLength_m || 6.0;
  const minReuse = settings.minReusable_m ?? 2.0;

  let totalRail = 0;
  let pieces = 0;
  let scrap = 0;
  let reusable = 0;

  for (const r of rails) {
    const len = railLen(r);
    totalRail += len;

    const n = Math.ceil(len / L);
    pieces += n;
    const offcut = n * L - len;

    if (offcut < minReuse) scrap += offcut;
    else reusable += offcut;
  }

  return { totalRail_m: totalRail, stockPieces: pieces, stockTotal_m: pieces * L, scrap_m: scrap, reusableOffcuts_m: reusable };
}
