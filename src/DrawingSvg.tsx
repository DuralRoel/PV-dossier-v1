import React, { forwardRef, useMemo } from "react";
import type { LayoutResult, RoofInput } from "./types";

type Props = {
  roof: RoofInput;
  layout: LayoutResult;
  onTogglePanel?: (panelIndex: number) => void; // klik om paneel weg te halen/terug te zetten
};

export const DrawingSvg = forwardRef<SVGSVGElement, Props>(({ roof, layout, onTogglePanel }, ref) => {
  const W = 1100;
  const H = 760;

  const roofW = roof.roofWidth_m;
  const roofH = roof.slopedLength_m;

  const scale = Math.min((W - 140) / roofW, (H - 160) / roofH);
  const ox = 70;
  const oy = 108; // was 90, nu lager omdat header hoger is

  const m2x = (m: number) => ox + m * scale;
  const m2y = (m: number) => oy + (roofH - m) * scale;

  const rafters = useMemo(() => {
    const out: number[] = [];
    if (!roof.rafterSpacing_m || roof.rafterSpacing_m <= 0) return out;
    for (let x = roof.rafterOffset_m; x <= roofW + 1e-9; x += roof.rafterSpacing_m) out.push(x);
    return out;
  }, [roof]);

  // START haak = laagste y (onderste rail) en dan laagste x
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

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="svg">
      {/* Header */}
      <rect x="0" y="0" width={W} height="70" fill="#0b1220" />
      <text x="18" y="33" fill="#fff" fontSize="16" fontFamily="Arial" fontWeight="700">
        Dakplan – panelen – rails – haken (V2.5)
      </text>
      <text x="18" y="55" fill="rgba(255,255,255,0.85)" fontSize="12" fontFamily="Arial">
        Keperverdeling indicatief – definitieve verankering te bepalen op werf (haakposities mogen afwijken binnen
        toegelaten tolerantie).
      </text>

      {/* Roof outline */}
      <rect x={m2x(0)} y={m2y(roofH)} width={roofW * scale} height={roofH * scale} fill="none" stroke="#111827" strokeWidth="2" />

      {/* Dimensions + azimuth */}
      <text x={m2x(0)} y={m2y(roofH) - 12} fontSize="12" fontFamily="Arial" fill="#0f172a">
        Breedte: {roofW.toFixed(2)} m
      </text>
      <text x={m2x(roofW)} y={m2y(roofH) - 12} textAnchor="end" fontSize="12" fontFamily="Arial" fill="#0f172a">
        Schuine zijde (plan): {roofH.toFixed(2)} m • Oriëntatie dakvlak: {roof.azimuth}
      </text>

      {/* Rafters */}
      {rafters.map((rx) => (
        <line key={rx} x1={m2x(rx)} y1={m2y(0)} x2={m2x(rx)} y2={m2y(roofH)} stroke="#e5e7eb" strokeWidth="1" />
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

      {/* Panels (klikbaar) */}
      {layout.panels.map((p, i) => (
        <g key={i} style={{ cursor: onTogglePanel ? "pointer" : "default" }} onClick={() => onTogglePanel?.(i)}>
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

      {/* Hooks + label keper */}
      {layout.hooks.map((h, i) => {
        const isStart = i === startHookIndex;
        return (
          <g key={i}>
            {/* altijd zwart (indicatief), start haak oranje */}
            <circle
              cx={m2x(h.x)}
              cy={m2y(h.y)}
              r={isStart ? 7 : 4}
              fill={isStart ? "#f59e0b" : "#111827"}
              stroke={isStart ? "#111827" : "none"}
              strokeWidth={isStart ? 2 : 0}
            />
            <line x1={m2x(h.x)} y1={m2y(h.y)} x2={m2x(h.x)} y2={m2y(h.y) - 12} stroke="#111827" strokeWidth="2" />

            {/* Alleen keperlabel tonen als er effectief gesnapt is */}
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
        <rect x={W - 330} y={70} width={300} height={170} fill="#fff" stroke="#cbd5e1" />
        <text x={W - 315} y={95} fontFamily="Arial" fontSize="12" fontWeight="700" fill="#0f172a">
          Legenda
        </text>

        <rect x={W - 315} y={112} width={18} height={10} fill="rgba(59,130,246,0.14)" stroke="#111827" />
        <text x={W - 290} y={121} fontFamily="Arial" fontSize="11" fill="#0f172a">
          Paneel (klik = verwijderen)
        </text>

        <rect x={W - 315} y={134} width={18} height={10} fill="rgba(239,68,68,0.08)" stroke="#ef4444" />
        <text x={W - 290} y={143} fontFamily="Arial" fontSize="11" fill="#0f172a">
          Keep-out (obstakel + buffer)
        </text>

        <line x1={W - 315} y1={160} x2={W - 290} y2={160} stroke="rgba(0,0,0,0.45)" strokeWidth="3" />
        <text x={W - 280} y={164} fontFamily="Arial" fontSize="11" fill="#0f172a">
          Rail
        </text>

        <circle cx={W - 306} cy={184} r="4" fill="#111827" />
        <text x={W - 290} y={188} fontFamily="Arial" fontSize="11" fill="#0f172a">
          Haak (indicatieve positie)
        </text>

        <circle cx={W - 306} cy={204} r="7" fill="#f59e0b" stroke="#111827" strokeWidth="2" />
        <text x={W - 290} y={208} fontFamily="Arial" fontSize="11" fill="#0f172a">
          START – 1e haak
        </text>
      </g>
    </svg>
  );
});

DrawingSvg.displayName = "DrawingSvg";
