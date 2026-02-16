import type { Rect } from "../types";

export function intersects(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h
  );
}

export function expandRect(r: Rect, buffer: number): Rect {
  return { x: r.x - buffer, y: r.y - buffer, w: r.w + 2 * buffer, h: r.h + 2 * buffer };
}
