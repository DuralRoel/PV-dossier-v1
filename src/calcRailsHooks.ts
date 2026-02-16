import type { Hook, MountingInput, Rail, Rect, RoofInput } from "../types";

function groupRows(panels: Rect[], tol = 0.05) {
  const sorted = [...panels].sort((a, b) => a.y - b.y);
  const rows: { refY: number; panels: Rect[] }[] = [];

  for (const p of sorted) {
    const hit = rows.find(r => Math.abs(p.y - r.refY) <= tol);
    if (!hit) rows.push({ refY: p.y, panels: [p] });
    else {
      hit.panels.push(p);
      hit.refY = hit.panels.reduce((s, x) => s + x.y, 0) / hit.panels.length;
    }
  }

  rows.forEach(r => r.panels.sort((a, b) => a.x - b.x));
  rows.sort((a, b) => a.refY - b.refY);
  return rows;
}

function snapToRafter(
  x: number,
  roof: RoofInput,
  mount: MountingInput
): { x: number; snapped: boolean; rafterX: number | null; rafterIndex: number | null } {
  const spacing = roof.rafterSpacing_m;
  if (!spacing || spacing <= 0) return { x, snapped: false, rafterX: null, rafterIndex: null };

  const idx = Math.round((x - roof.rafterOffset_m) / spacing);
  const rX = roof.rafterOffset_m + idx * spacing;

  if (Math.abs(rX - x) <= mount.snapTol_m) {
    return { x: rX, snapped: true, rafterX: rX, rafterIndex: idx };
  }
  return { x, snapped: false, rafterX: null, rafterIndex: null };
}

/**
 * V2.3 rails + haken:
 * - rails per rij (meestal 2) op vaste fracties over paneelhoogte
 * - haken: maxEndDist (0.20m) vanaf veld-einde, maxHookSpacing (1.0m) tussen haken
 * - elke haak "snapt" naar dichtste keper + we tonen welke keper (index + x)
 */
export function calcRailsAndHooks(
  panels: Rect[],
  roof: RoofInput,
  mount: MountingInput
): { rails: Rail[]; hooks: Hook[]; rowsCount: number } {
  const rows = groupRows(panels);
  const rails: Rail[] = [];
  const hooks: Hook[] = [];

  const railOffsets =
    mount.railsPerRow === 2 ? [0.28, 0.72] : mount.railsPerRow === 3 ? [0.22, 0.5, 0.78] : [0.3, 0.7];

  for (const row of rows) {
    if (row.panels.length === 0) continue;

    const minX = Math.min(...row.panels.map(p => p.x));
    const maxX = Math.max(...row.panels.map(p => p.x + p.w));
    const minY = Math.min(...row.panels.map(p => p.y));
    const ph = row.panels[0].h;

    const fieldMin = minX;
    const fieldMax = maxX;

    const railStart = fieldMin - mount.railEdgeMargin_m;
    const railEnd = fieldMax + mount.railEdgeMargin_m;

    const hookMin = fieldMin + mount.maxEndDist_m;
    const hookMax = fieldMax - mount.maxEndDist_m;

    for (const off of railOffsets) {
      const y = minY + ph * off;

      rails.push({ x1: railStart, y1: y, x2: railEnd, y2: y });

      // hooks positions along the field, then snap
      if (hookMax <= hookMin) {
        const a = snapToRafter(fieldMin + 0.01, roof, mount);
        const b = snapToRafter(fieldMax - 0.01, roof, mount);
        [a, b].forEach(s => hooks.push({ x: s.x, y, snapped: s.snapped, rafterX: s.rafterX, rafterIndex: s.rafterIndex }));
        continue;
      }

      const span = hookMax - hookMin;
      const segments = Math.max(1, Math.ceil(span / mount.maxHookSpacing_m));
      const step = span / segments;

      const raw = Array.from({ length: segments + 1 }, (_, i) => hookMin + i * step);

      // snap + dedupe by x/y
      const uniq = new Map<string, Hook>();
      for (const x0 of raw) {
        const s = snapToRafter(x0, roof, mount);
        const key = `${s.x.toFixed(4)}|${y.toFixed(4)}`;
        uniq.set(key, { x: s.x, y, snapped: s.snapped, rafterX: s.rafterX, rafterIndex: s.rafterIndex });
      }

      uniq.forEach(v => hooks.push(v));
    }
  }

  return { rails, hooks, rowsCount: rows.length };
}
