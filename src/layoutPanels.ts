import type { Obstacle, PanelInput, Rect, RoofInput } from "../types";
import { expandRect, intersects } from "./geom";

export function buildKeepouts(obstacles: Obstacle[]): Rect[] {
  return obstacles.map(o =>
    expandRect({ x: o.x_m, y: o.y_m, w: o.w_m, h: o.h_m }, o.buffer_m)
  );
}

/**
 * V2.2: simpel raster-fill binnen (dak - marge) en buiten keepouts.
 * Dakvlak is rechthoekig in plan (V2.3). Trapezium/parallellogram doen we in V2.4+.
 */
export function autoFillPanels(roof: RoofInput, panel: PanelInput, keepouts: Rect[]): Rect[] {
  const roofW = roof.roofWidth_m;
  const roofH = roof.slopedLength_m;

  let pw = panel.panelW_m;
  let ph = panel.panelH_m;
  if (panel.orientation === "landscape") [pw, ph] = [ph, pw];

  const x0 = roof.margin_m;
  const y0 = roof.margin_m;
  const x1 = roofW - roof.margin_m;
  const y1 = roofH - roof.margin_m;

  const out: Rect[] = [];
  for (let y = y0; y + ph <= y1 + 1e-9; y += ph + panel.gap_m) {
    for (let x = x0; x + pw <= x1 + 1e-9; x += pw + panel.gap_m) {
      const r = { x, y, w: pw, h: ph };
      if (!keepouts.some(k => intersects(r, k))) out.push(r);
    }
  }
  return out;
}

export function countRows(panels: Rect[], tol = 0.05): number {
  const ys = panels.map(p => p.y).sort((a, b) => a - b);
  let rows = 0;
  let last: number | undefined;
  for (const y of ys) {
    if (last === undefined || Math.abs(y - last) > tol) {
      rows++;
      last = y;
    }
  }
  return rows;
}
