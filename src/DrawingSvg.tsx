import React, { forwardRef, useMemo } from "react";
import type { LayoutResult, RoofInput } from "./types";
import type { CableResult } from "./cable";

type Props = {
  roof: RoofInput;
  layout: LayoutResult;
  cable?: CableResult;
  onTogglePanel?: (panelIndex: number) => void;
  pickingExit?: boolean;
  onPickExit?: (x_m: number, y_m: number) => void;
};

export const DrawingSvg = forwardRef<SVGSVGElement, Props>(
  ({ roof, layout, cable, onTogglePanel, pickingExit, onPickExit }, ref) => {
    const W = 1100;
    const H = 800;

    const roofW = roof.roofWidth_m;
    const roofH = roof.slopedLength_m;

    const scale = Math.min((W - 140) / roofW, (H - 190) / roofH);
    const ox = 70;
    const oy = 118;

    const m2x = (m: number) => ox + m * scale;
    const m2y = (m: number) => oy + (roofH - m) * scale;

    const x2m = (px: number) => (px - ox) / scale;
    const y2m = (py: number) => roofH - (py - oy) / scale;

    const rafters = useMemo(() => {
      const out: number[] = [];
      if (!roof.rafterSpacing_m || roof.rafterSpacing_m <= 0) return out;
      for (let x = roof.rafterOffset_m; x <= roofW + 1e-9; x += roof.rafterSpacing_m) out.push(x);
      return out;
    }, [roof]);

    // "START – 1e haak": kies de haak het meest links onder (laagste y, dan laagste x)
    const startHookIndex = useMemo(() => {
      if (!layout.hooks.length) return -1;
      let best = 0;
      for (let i = 1; i < layout.hooks.length; i++) {
        const a = layout.hooks[i];
        const b = layout.hooks[best];
        if (a.y < b.y - 1e-9) best = i;
        else if (Math.abs(a.y - b.y) < 1e-9 && a.x < b.x) best = i;
      }
      return best;
    }, [layout.hooks]);

    function handleClick(e: React.MouseEvent<SVGSVGElement>) {
      if (!pickingExit || !onPickExit) return;
      const rect = (e.currentTarget as any).getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const x = Math.min(Math.max(x2m(px), 0), roofW);
      const y = Math.min(Math.max(y2m(py), 0), roofH);
      onPickExit(x, y);
    }

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        className="svg"
        onClick={handleClick}
      >
        {/* Header */}
        <rect x="0" y="0" width={W} height="82" fill="#0b1220" />
        <text x="18" y="33" fill="#fff" fontSize="16" fontFamily="Arial" fontWeight="700">
          Dakplan – panelen – rails – haken – kabel (V2.8)
        </text>
        <text x="18" y="55" fill="rgba(255,255,255,0.85)" fontSize="12" fontFamily="Arial">
          Keperverdeling indicatief – definitieve verankering te bepalen op werf (haakposities mogen afwijken binnen
          toegelaten tolerantie).
        </text>
        {pickingExit && (
          <text x="18" y="74" fill="rgba(255,255,255,0.9)" fontSize="12" fontFamily="Arial">
            Exit point kiezen: klik op het dakvlak waar de kabel naar binnen gaat.
          </text>
        )}

        {/* Roof outline */}
        <rect
          x={m2x(0)}
          y={m2y(roofH)}
          width={roofW * scale}
          height={roofH * scale}
          fill="none"
          stroke="#111827"
          strokeWidth="2"
        />

        {/* Dimensions + azimuth */}
        <text x={m2x(0)} y={m2y(roofH) - 12} fontSize="12" fontFamily="Arial" fill="#0f172a">
          Breedte: {roofW.toFixed(2)} m
        </text>
        <text
          x={m2x(roofW)}
          y={m2y(roofH) - 12}
          textAnchor="end"
          fontSize="12"
          fontFamily="Arial"
          fill="#0f172a"
        >
          Schuine zijde (plan): {roofH.toFixed(2)} m • Oriëntatie dakvlak: {roof.azimuth}
        </text>

        {/* Rafters */}
        {rafters.map((rx) => (
          <line
            key={rx}
            x1={m2x(rx)}
            y1={m2y(0)}
            x2={m2x(rx)}
            y2={m2y(roofH)}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Keep-outs */}
        {layout.keepouts.map((k, i) => (
          <rect
            key={i}
            x={m2x(k.x)}
            y={m2y(k.y + k.h)}
            width={k.w * scale}
            height={k.h * scale}
            fill="rgba(239,68,68,0.08)"
            stroke="#ef4444"
            strokeWidth="1.5"
          />
        ))}

        {/* Cable strings (behind panels) */}
        {cable?.strings.map((s) => (
          <g key={s.stringIndex}>
            <polyline
              points={s.points.map((p) => `${m2x(p.x)},${m2y(p.y)}`).join(" ")}
              fill="none"
              stroke="rgba(34,197,94,0.75)"
              strokeWidth="3"
            />
            {s.points.length > 0 && (
              <text
                x={m2x(s.points[0].x) + 6}
                y={m2y(s.points[0].y) - 6}
                fontSize="12"
                fontFamily="Arial"
                fontWeight="700"
                fill="rgba(22,101,52,0.95)"
              >
                S{s.stringIndex}
              </text>
            )}
          </g>
        ))}

        {/* Exit marker */}
        {cable && (
          <g>
            <circle
              cx={m2x(cable.exitPoint.x)}
              cy={m2y(cable.exitPoint.y)}
              r={7}
              fill="rgba(16,185,129,1)"
              stroke="#111827"
              strokeWidth="2"
            />
            <text
              x={m2x(cable.exitPoint.x) + 8}
              y={m2y(cable.exitPoint.y) + 4}
              fontSize="11"
              fontFamily="Arial"
              fill="#0f172a"
            >
              Exit
            </text>
          </g>
        )}

        {/* Panels (click to remove) */}
        {layout.panels.map((p, i) => (
          <g
            key={i}
            style={{ cursor: onTogglePanel ? "pointer" : "default" }}
            onClick={(ev) => {
              ev.stopPropagation();
              onTogglePanel?.(i);
            }}
          >
            <rect
              x={m2x(p.x)}
              y={m2y(p.y + p.h)}
              width={p.w * scale}
              height={p.h * scale}
              fill="rgba(59,130,246,0.14)"
              stroke="#111827"
              strokeWidth="1"
            />
            <text x={m2x(p.x) + 3} y={m2y(p.y + p.h) + 12} fontSize="10" fontFamily="Arial" fill="#0f172a">
              {i + 1}
            </text>
          </g>
        ))}

        {/* Rails */}
        {layout.rails.map((r, i) => (
          <line
            key={i}
            x1={m2x(r.x1)}
            y1={m2y(r.y1)}
            x2={m2x(r.x2)}
            y2={m2y(r.y2)}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="3"
          />
        ))}

        {/* Hooks */}
        {layout.hooks.map((h, i) => {
          const isStart = i === startHookIndex;
          return (
            <g key={i}>
              <circle
                cx={m2x(h.x)}
                cy={m2y(h.y)}
                r={isStart ? 7 : 4}
                fill={isStart ? "#f59e0b" : "#111827"}
                stroke={isStart ? "#111827" : "none"}
                strokeWidth={isStart ? 2 : 0}
              />
              <line x1={m2x(h.x)} y1={m2y(h.y)} x2={m2x(h.x)} y2={m2y(h.y) - 12} stroke="#111827" strokeWidth="2" />
              {h.snapped && h.rafterIndex !== null && (
                <text x={m2x(h.x) + 6} y={m2y(h.y) - 14} fontSize="10" fontFamily="Arial" fill="#0f172a">
                  K{h.rafterIndex} ({h.rafterX?.toFixed(2)}m)
                </text>
              )}
              {isStart && (
                <text x={m2x(h.x) + 6} y={m2y(h.y) + 16} fontSize="12" fontFamily="Arial" fontWeight="700" fill="#b45309">
                  START – 1e haak
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g>
          <rect x={W - 350} y={92} width={320} height={220} fill="#fff" stroke="#cbd5e1" />
          <text x={W - 335} y={117} fontFamily="Arial" fontSize="12" fontWeight="700" fill="#0f172a">
            Legenda
          </text>

          <rect x={W - 335} y={135} width={18} height={10} fill="rgba(59,130,246,0.14)" stroke="#111827" />
          <text x={W - 310} y={144} fontFamily="Arial" fontSize="11" fill="#0f172a">
            Paneel (klik = verwijderen)
          </text>

          <rect x={W - 335} y={157} width={18} height={10} fill="rgba(239,68,68,0.08)" stroke="#ef4444" />
          <text x={W - 310} y={166} fontFamily="Arial" fontSize="11" fill="#0f172a">
            Keep-out
          </text>

          <line x1={W - 335} y1={183} x2={W - 310} y2={183} stroke="rgba(0,0,0,0.45)" strokeWidth="3" />
          <text x={W - 300} y={187} fontFamily="Arial" fontSize="11" fill="#0f172a">
            Rail
          </text>

          <circle cx={W - 326} cy={207} r="4" fill="#111827" />
          <text x={W - 310} y={211} fontFamily="Arial" fontSize="11" fill="#0f172a">
            Haak (indicatief)
          </text>

          <circle cx={W - 326} cy={227} r="7" fill="#f59e0b" stroke="#111827" strokeWidth="2" />
          <text x={W - 310} y={231} fontFamily="Arial" fontSize="11" fill="#0f172a">
            START – 1e haak
          </text>

          <line x1={W - 335} y1={250} x2={W - 310} y2={250} stroke="rgba(34,197,94,0.75)" strokeWidth="3" />
          <text x={W - 300} y={254} fontFamily="Arial" fontSize="11" fill="#0f172a">
            Solarkabel (string)
          </text>

          <circle cx={W - 326} cy={273} r="7" fill="rgba(16,185,129,1)" stroke="#111827" strokeWidth="2" />
          <text x={W - 310} y={277} fontFamily="Arial" fontSize="11" fill="#0f172a">
            Exit point
          </text>
        </g>
      </svg>
    );
  }
);

DrawingSvg.displayName = "DrawingSvg";
