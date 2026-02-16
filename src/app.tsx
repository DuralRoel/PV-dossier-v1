import React, { useMemo, useState } from "react";
import type { MountingInput, Obstacle, PanelInput, RoofInput, LayoutResult, Rect, InverterInput } from "./types";
import ObstaclesTable from "./ObstaclesTable";
import { DrawingSvg } from "./DrawingSvg";
import { buildKeepouts, autoFillPanels, countRows } from "./layoutPanels";
import { calcRailsAndHooks } from "./calcRailsHooks";
import { calcStrings } from "./stringCalc";

type OrientationResolved = "portrait" | "landscape";

const DEFAULTS = {
  roof: {
    roofWidth_m: 8,
    slopedLength_m: 5,
    margin_m: 0.20,
    rafterSpacing_m: 0.60,
    rafterOffset_m: 0.00,
    azimuth: "ZO",
  } as RoofInput,

  panel: {
    panelW_m: 1.134,
    panelH_m: 1.722,
    orientationMode: "auto",
    gap_m: 0.02,
    wp: 450,
    voc: 49.5,
  } as PanelInput,

  inverter: {
    vocMin: 200,
    vocMax: 600,
  } as InverterInput,

  mount: {
    railsPerRow: 2,
    railEdgeMargin_m: 0.12,
    maxHookSpacing_m: 1.00,
    maxEndDist_m: 0.20,
    snapTol_m: 0.10,
  } as MountingInput,
};

function sortTopLeftFirst(panels: Rect[], tol = 0.03): Rect[] {
  // start altijd linksboven: hoogste y eerst, dan links
  const ps = [...panels].sort((a, b) => b.y - a.y);

  const rows: Rect[][] = [];
  for (const p of ps) {
    const hit = rows.find((r) => Math.abs(r[0].y - p.y) <= tol);
    if (!hit) rows.push([p]);
    else hit.push(p);
  }

  rows.sort((ra, rb) => rb[0].y - ra[0].y);
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

function resolveOrientation(
  panel: PanelInput,
  roof: RoofInput,
  keepouts: Rect[],
  targetPanels: number | null,
  maximize: boolean
): {
  resolved: OrientationResolved;
  maxPortrait: number;
  maxLandscape: number;
  panelsPortrait: Rect[];
  panelsLandscape: Rect[];
} {
  const mk = (resolved: OrientationResolved) => {
    // autoFillPanels uit V1/V2 verwacht "orientation" in panel input (string)
    return autoFillPanels(roof, { ...(panel as any), orientation: resolved } as any, keepouts);
  };

  const panelsPortrait = mk("portrait");
  const panelsLandscape = mk("landscape");
  const maxPortrait = panelsPortrait.length;
  const maxLandscape = panelsLandscape.length;

  if (panel.orientationMode === "portrait") return { resolved: "portrait", maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
  if (panel.orientationMode === "landscape") return { resolved: "landscape", maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };

  const goal = maximize || !targetPanels || targetPanels <= 0 ? null : targetPanels;

  if (goal !== null) {
    const pOk = maxPortrait >= goal;
    const lOk = maxLandscape >= goal;
    if (pOk && !lOk) return { resolved: "portrait", maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
    if (lOk && !pOk) return { resolved: "landscape", maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
    if (pOk && lOk) {
      const pReserve = maxPortrait - goal;
      const lReserve = maxLandscape - goal;
      return { resolved: pReserve >= lReserve ? "portrait" : "landscape", maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
    }
    return { resolved: maxPortrait >= maxLandscape ? "portrait" : "landscape", maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
  }

  return { resolved: maxPortrait >= maxLandscape ? "portrait" : "landscape", maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
}

export default function App() {
  const [roof, setRoof] = useState<RoofInput>(DEFAULTS.roof);
  const [panel, setPanel] = useState<PanelInput>(DEFAULTS.panel);
  const [inverter, setInverter] = useState<InverterInput>(DEFAULTS.inverter);
  const [mount, setMount] = useState<MountingInput>(DEFAULTS.mount);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  // V2.4 doel/max
  const [targetCount, setTargetCount] = useState<number>(12);
  const [maximize, setMaximize] = useState<boolean>(false);

  // V2.4 interactief "wegklikken"
  const [removedBaseIdx, setRemovedBaseIdx] = useState<Set<number>>(new Set());

  const keepouts = useMemo(() => buildKeepouts(obstacles), [obstacles]);

  const orientationResolved = useMemo(() => {
    return resolveOrientation(panel, roof, keepouts, targetCount, maximize);
  }, [panel, roof, keepouts, targetCount, maximize]);

  const basePanels = useMemo(() => {
    const all = orientationResolved.resolved === "portrait" ? orientationResolved.panelsPortrait : orientationResolved.panelsLandscape;
    const sorted = sortTopLeftFirst(all);
    const goal = maximize || !targetCount || targetCount <= 0 ? sorted.length : Math.min(targetCount, sorted.length);
    return sorted.slice(0, goal);
  }, [orientationResolved, targetCount, maximize]);

  const placedPanels = useMemo(() => {
    return basePanels.filter((_, i) => !removedBaseIdx.has(i));
  }, [basePanels, removedBaseIdx]);

  const layout: LayoutResult = useMemo(() => {
    const rowsCount = countRows(placedPanels);
    const { rails, hooks } = calcRailsAndHooks(placedPanels, roof, mount);
    return { keepouts, panels: placedPanels, rowsCount, rails, hooks };
  }, [keepouts, placedPanels, roof, mount]);

  const maxPossible = useMemo(() => Math.max(orientationResolved.maxPortrait, orientationResolved.maxLandscape), [orientationResolved]);
  const totalWp = useMemo(() => layout.panels.length * (panel.wp || 0), [layout.panels.length, panel.wp]);
  const strings = useMemo(() => calcStrings(layout.panels.length, panel, inverter), [layout.panels.length, panel, inverter]);

  function reapplyTarget() {
    setRemovedBaseIdx(new Set());
  }

  function togglePanel(idxInPlaced: number) {
    // map idx in placedPanels naar idx in basePanels
    let baseIndex = -1;
    let seen = -1;
    for (let i = 0; i < basePanels.length; i++) {
      if (removedBaseIdx.has(i)) continue;
      seen++;
      if (seen === idxInPlaced) {
        baseIndex = i;
        break;
      }
    }
    if (baseIndex === -1) return;

    setRemovedBaseIdx((prev) => {
      const next = new Set(prev);
      if (next.has(baseIndex)) next.delete(baseIndex);
      else next.add(baseIndex);
      return next;
    });
  }

  return (
    <div className="page">
      <h2>PV Dossier – V2.5 (functioneel)</h2>

      <div className="grid">
        <div>
          <div className="card">
            <h3>Dakvlak</h3>
            <div className="grid2">
              <label>
                Breedte dakvlak (m)
                <input type="number" step="0.01" value={roof.roofWidth_m} onChange={(e) => setRoof({ ...roof, roofWidth_m: +e.target.value })} />
              </label>
              <label>
                Schuine zijde (plan) (m)
                <input type="number" step="0.01" value={roof.slopedLength_m} onChange={(e) => setRoof({ ...roof, slopedLength_m: +e.target.value })} />
              </label>
              <label>
                Marge (m)
                <input type="number" step="0.01" value={roof.margin_m} onChange={(e) => setRoof({ ...roof, margin_m: +e.target.value })} />
              </label>
              <label>
                Dakoriëntatie (metadata)
                <select value={roof.azimuth} onChange={(e) => setRoof({ ...roof, azimuth: e.target.value as any })}>
                  <option value="O">Oost</option>
                  <option value="ZO">Zuid-Oost</option>
                  <option value="Z">Zuid</option>
                  <option value="ZW">Zuid-West</option>
                  <option value="W">West</option>
                  <option value="NO">Noord-Oost</option>
                  <option value="N">Noord</option>
                  <option value="NW">Noord-West</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card">
            <h3>Kepers</h3>
            <div className="grid2">
              <label>
                Keperafstand (m)
                <input type="number" step="0.01" value={roof.rafterSpacing_m} onChange={(e) => setRoof({ ...roof, rafterSpacing_m: +e.target.value })} />
              </label>
              <label>
                Keper offset (m)
                <input type="number" step="0.01" value={roof.rafterOffset_m} onChange={(e) => setRoof({ ...roof, rafterOffset_m: +e.target.value })} />
              </label>
            </div>
            <p className="muted">Haken snappen naar dichtste keper binnen tolerantie. Labels tonen K-index + x-positie.</p>
          </div>

          <div className="card">
            <h3>Panelen</h3>
            <div className="grid2">
              <label>
                Paneel breedte (m)
                <input
                  type="number"
                  step="0.001"
                  value={panel.panelW_m}
                  onChange={(e) => {
                    setPanel({ ...panel, panelW_m: +e.target.value });
                    reapplyTarget();
                  }}
                />
              </label>
              <label>
                Paneel hoogte (m)
                <input
                  type="number"
                  step="0.001"
                  value={panel.panelH_m}
                  onChange={(e) => {
                    setPanel({ ...panel, panelH_m: +e.target.value });
                    reapplyTarget();
                  }}
                />
              </label>

              <label>
                Oriëntatie panelen
                <select
                  value={panel.orientationMode}
                  onChange={(e) => {
                    setPanel({ ...panel, orientationMode: e.target.value as any });
                    reapplyTarget();
                  }}
                >
                  <option value="auto">Auto</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>

              <label>
                Paneelafstand (gap) (m)
                <input
                  type="number"
                  step="0.001"
                  value={panel.gap_m}
                  onChange={(e) => {
                    setPanel({ ...panel, gap_m: +e.target.value });
                    reapplyTarget();
                  }}
                />
              </label>

              <label>
                Doel aantal panelen
                <input
                  type="number"
                  step="1"
                  value={targetCount}
                  onChange={(e) => {
                    setTargetCount(+e.target.value);
                    reapplyTarget();
                  }}
                />
              </label>

              <label>
                Maximaliseer (override)
                <select
                  value={maximize ? "yes" : "no"}
                  onChange={(e) => {
                    setMaximize(e.target.value === "yes");
                    reapplyTarget();
                  }}
                >
                  <option value="no">Nee</option>
                  <option value="yes">Ja (max)</option>
                </select>
              </label>

              <label>
                Wp per paneel
                <input type="number" step="1" value={panel.wp} onChange={(e) => setPanel({ ...panel, wp: +e.target.value })} />
              </label>
              <label>
                Voc per paneel (V)
                <input type="number" step="0.1" value={panel.voc} onChange={(e) => setPanel({ ...panel, voc: +e.target.value })} />
              </label>
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btnGhost" onClick={() => setRemovedBaseIdx(new Set())}>
                Reset weggeklikte panelen
              </button>
              <div className="muted">
                Start plaatsing: <b>links boven</b>. Klik op een paneel om het te verwijderen (incl. rails/haken herberekend).
              </div>
            </div>

            <p className="muted">
              Max mogelijk: Portrait {orientationResolved.maxPortrait} • Landscape {orientationResolved.maxLandscape} • Gekozen:{" "}
              <b>{orientationResolved.resolved}</b>
              {!maximize && targetCount > maxPossible ? ` • ⚠ doel (${targetCount}) > max (${maxPossible})` : ""}
            </p>
          </div>

          <div className="card">
            <h3>Montage</h3>
            <div className="grid2">
              <label>
                Rails per rij
                <input type="number" step="1" value={mount.railsPerRow} onChange={(e) => setMount({ ...mount, railsPerRow: +e.target.value })} />
              </label>
              <label>
                Rail edge margin (m)
                <input type="number" step="0.01" value={mount.railEdgeMargin_m} onChange={(e) => setMount({ ...mount, railEdgeMargin_m: +e.target.value })} />
              </label>
              <label>
                Max haakafstand (m)
                <input type="number" step="0.01" value={mount.maxHookSpacing_m} onChange={(e) => setMount({ ...mount, maxHookSpacing_m: +e.target.value })} />
              </label>
              <label>
                Max afstand einde paneel (m)
                <input type="number" step="0.01" value={mount.maxEndDist_m} onChange={(e) => setMount({ ...mount, maxEndDist_m: +e.target.value })} />
              </label>
              <label>
                Snap tolerantie keper (m)
                <input type="number" step="0.01" value={mount.snapTol_m} onChange={(e) => setMount({ ...mount, snapTol_m: +e.target.value })} />
              </label>
            </div>
            <p className="muted">Regels: max 20cm vanaf veld-einde • ~100cm tussen haken • snap naar dichtste keper.</p>
          </div>

          <div className="card">
            <h3>Omvormer (V2.5)</h3>
            <div className="grid2">
              <label>
                Min string Voc (V)
                <input type="number" step="1" value={inverter.vocMin} onChange={(e) => setInverter({ ...inverter, vocMin: +e.target.value })} />
              </label>
              <label>
                Max string Voc (V)
                <input type="number" step="1" value={inverter.vocMax} onChange={(e) => setInverter({ ...inverter, vocMax: +e.target.value })} />
              </label>
            </div>
            <p className="muted">Tool rekent nMin/nMax en verdeelt panelen over strings (basis).</p>
          </div>

          <ObstaclesTable
            obstacles={obstacles}
            onChange={(o) => {
              setObstacles(o);
              reapplyTarget();
            }}
          />
        </div>

        <div>
          <div className="card">
            <h3>Resultaat</h3>
            <div className="kpis">
              <div>
                <b>Geplaatste panelen</b>
                {layout.panels.length}
              </div>
              <div>
                <b>Totaal vermogen</b>
                {totalWp} Wp
              </div>
              <div>
                <b>Rijen</b>
                {layout.rowsCount}
              </div>
              <div>
                <b>Rails</b>
                {layout.rails.length}
              </div>
              <div>
                <b>Haken</b>
                {layout.hooks.length}
              </div>
              <div>
                <b>Dakoriëntatie</b>
                {roof.azimuth}
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Strings</h3>
            <div className="kpis">
              <div>
                <b>nMin</b>
                {strings.nMin || "-"}
              </div>
              <div>
                <b>nMax</b>
                {strings.nMax || "-"}
              </div>
              <div>
                <b>Serie</b>
                {strings.nSeries ?? "-"}
              </div>
              <div>
                <b>Strings</b>
                {strings.strings.length || "-"}
              </div>
              <div>
                <b>Voc</b>
                {strings.vocString ? `${strings.vocString.toFixed(0)} V` : "-"}
              </div>
              <div>
                <b>Status</b>
                {strings.ok ? "OK" : "Check"}
              </div>
            </div>
            <p className="muted">{strings.message}</p>
            {strings.strings.length > 0 && <p className="muted">Verdeling: {strings.strings.map((s, i) => `S${i + 1}: ${s}`).join(" • ")}</p>}
          </div>

          <DrawingSvg roof={roof} layout={layout} onTogglePanel={togglePanel} />
        </div>
      </div>
    </div>
  );
}

