import type { Rect, RoofInput } from "./types";

export type CableExitMode = "LT" | "RT" | "LB" | "RB" | "CUSTOM";

export type CableSettings = {
  exitMode: CableExitMode;
  exitCustom?: { x: number; y: number }; // meter, oorsprong linksonder
  slackPercent: number;                  // +% reserve
  extraToInverter_m: number;             // schatting buiten dak
  routePreset: "achter afvoerbuis" | "technische schacht" | "via schouw" | "via binnenzijde" | "anders";
  routeDescription: string;
};

export type StringCable = {
  stringIndex: number;
  panelIndices: number[];
  points: { x: number; y: number }[]; // centers + exit
  lengthOnRoof_m: number;
};

export type CableResult = {
  exitPoint: { x: number; y: number };
  snakeOrder: number[];
  strings: StringCable[];
  totalOnRoof_m: number;
  totalWithExtras_m: number;
  totalRecommended_m: number;
};

function center(p: Rect) { return { x: p.x + p.w / 2, y: p.y + p.h / 2 }; }
function dist(a: {x:number;y:number}, b: {x:number;y:number}) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function getExitPoint(roof: RoofInput, mode: CableExitMode, custom?: {x:number;y:number}) {
  const m = roof.margin_m || 0;
  switch (mode) {
    case "LT": return { x: m, y: roof.slopedLength_m - m };
    case "RT": return { x: roof.roofWidth_m - m, y: roof.slopedLength_m - m };
    case "LB": return { x: m, y: m };
    case "RB": return { x: roof.roofWidth_m - m, y: m };
    case "CUSTOM": return custom ?? { x: roof.roofWidth_m - m, y: roof.slopedLength_m - m };
  }
}

export function buildSnakeOrder(panels: Rect[], tol = 0.03): number[] {
  const indexed = panels.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => b.p.y - a.p.y);

  const rows: { y: number; items: {p:Rect;i:number}[] }[] = [];
  for (const it of indexed) {
    const hit = rows.find(r => Math.abs(r.y - it.p.y) <= tol);
    if (!hit) rows.push({ y: it.p.y, items: [it] });
    else hit.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);

  const order: number[] = [];
  rows.forEach((r, rowIdx) => {
    r.items.sort((a, b) => a.p.x - b.p.x);
    const items = rowIdx % 2 === 0 ? r.items : [...r.items].reverse();
    for (const it of items) order.push(it.i);
  });
  return order;
}

export function calcCable(panels: Rect[], roof: RoofInput, stringsPanelsCounts: number[], settings: CableSettings): CableResult {
  const exitPoint = getExitPoint(roof, settings.exitMode, settings.exitCustom);
  const snakeOrder = buildSnakeOrder(panels);

  const strings: StringCable[] = [];
  let cursor = 0;
  let totalOnRoof = 0;

  for (let s = 0; s < stringsPanelsCounts.length; s++) {
    const count = stringsPanelsCounts[s];
    const idxs = snakeOrder.slice(cursor, cursor + count);
    cursor += count;

    const pts = idxs.map(i => center(panels[i]));
    const ptsWithExit = [...pts, exitPoint];

    let len = 0;
    for (let i = 0; i < ptsWithExit.length - 1; i++) len += dist(ptsWithExit[i], ptsWithExit[i + 1]);
    totalOnRoof += len;

    strings.push({ stringIndex: s + 1, panelIndices: idxs, points: ptsWithExit, lengthOnRoof_m: len });
  }

  const totalWithExtras = totalOnRoof + (settings.extraToInverter_m || 0);
  const totalRecommended = totalWithExtras * (1 + (settings.slackPercent || 0) / 100);

  return { exitPoint, snakeOrder, strings, totalOnRoof_m: totalOnRoof, totalWithExtras_m: totalWithExtras, totalRecommended_m: totalRecommended };
}
