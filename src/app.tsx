import React, { useMemo, useState } from "react";
import type { MountingInput, Obstacle, PanelInput, RoofInput, LayoutResult, Rect, InverterInput } from "./types";
import ObstaclesTable from "./ObstaclesTable";
import { DrawingSvg } from "./DrawingSvg";
import { buildKeepouts, autoFillPanels, countRows } from "./layoutPanels";
import { calcRailsAndHooks } from "./calcRailsHooks";
import { calcStrings } from "./stringCalc";
import AdminProducts from "./AdminProducts";
import { getInverters, getPanels, makeId } from "./products";
import { CableSettings, calcCable } from "./cable";
import { calcRailStock, RailStockSettings } from "./railStock";

type OrientationResolved = "portrait" | "landscape";

const DEFAULTS = {
  roof: { roofWidth_m: 8, slopedLength_m: 5, margin_m: 0.2, rafterSpacing_m: 0.6, rafterOffset_m: 0.0, azimuth: "ZO" } as RoofInput,
  panel: { panelW_m: 1.134, panelH_m: 1.722, orientationMode: "auto", gap_m: 0.02, wp: 450, voc: 49.5 } as PanelInput,
  inverter: {
    brand: "Huawei",
    model: "SUN2000-6KTL-M1",
    vocMin: 200,
    vocMax: 600,
    mpptCount: 2,
    stringsPerMppt: 1,
    mpptMinV: 90,
    mpptMaxV: 560,
    acPowerW: 6000,
    maxDcPowerW: 9000,
  } as InverterInput,
  mount: { railsPerRow: 2, railEdgeMargin_m: 0.12, maxHookSpacing_m: 1.0, maxEndDist_m: 0.2, snapTol_m: 0.1 } as MountingInput,
};

function sortTopLeftFirst(panels: Rect[], tol = 0.03): Rect[] {
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

function resolveOrientation(panel: PanelInput, roof: RoofInput, keepouts: Rect[], targetPanels: number | null, maximize: boolean) {
  const mk = (resolved: OrientationResolved) => autoFillPanels(roof, { ...(panel as any), orientation: resolved } as any, keepouts);

  const panelsPortrait = mk("portrait");
  const panelsLandscape = mk("landscape");
  const maxPortrait = panelsPortrait.length;
  const maxLandscape = panelsLandscape.length;

  if (panel.orientationMode === "portrait") return { resolved: "portrait" as const, maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
  if (panel.orientationMode === "landscape") return { resolved: "landscape" as const, maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };

  const goal = maximize || !targetPanels || targetPanels <= 0 ? null : targetPanels;

  if (goal !== null) {
    const pOk = maxPortrait >= goal;
    const lOk = maxLandscape >= goal;
    if (pOk && !lOk) return { resolved: "portrait" as const, maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
    if (lOk && !pOk) return { resolved: "landscape" as const, maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
    if (pOk && lOk) {
      const pReserve = maxPortrait - goal;
      const lReserve = maxLandscape - goal;
      return { resolved: pReserve >= lReserve ? ("portrait" as const) : ("landscape" as const), maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
    }
    return { resolved: maxPortrait >= maxLandscape ? ("portrait" as const) : ("landscape" as const), maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
  }

  return { resolved: maxPortrait >= maxLandscape ? ("portrait" as const) : ("landscape" as const), maxPortrait, maxLandscape, panelsPortrait, panelsLandscape };
}

export default function App() {
  const [tab, setTab] = useState<"dossier" | "admin">("dossier");
  const [adminMode, setAdminMode] = useState(false);

  const [roof, setRoof] = useState<RoofInput>(DEFAULTS.roof);
  const [panel, setPanel] = useState<PanelInput>(DEFAULTS.panel);
  const [inverter, setInverter] = useState<InverterInput>(DEFAULTS.inverter);
  const [mount, setMount] = useState<MountingInput>(DEFAULTS.mount);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  const [targetCount, setTargetCount] = useState<number>(12);
  const [maximize, setMaximize] = useState<boolean>(false);

  const [removedBaseIdx, setRemovedBaseIdx] = useState<Set<number>>(new Set());

  // products (localStorage)
  const panelsList = useMemo(() => getPanels(), [tab]);
  const invertersList = useMemo(() => getInverters(), [tab]);

  const [selectedPanelId, setSelectedPanelId] = useState<string>(panelsList[0]?.id ?? makeId("AIKO", "Neostar 3S+ 450"));
  const [selectedInverterId, setSelectedInverterId] = useState<string>(invertersList[0]?.id ?? makeId("Huawei", "SUN2000-6KTL-M1"));

  // cable settings
  const [cableSettings, setCableSettings] = useState<CableSettings>({
    exitMode: "RT",
    exitCustom: undefined,
    slackPercent: 10,
    extraToInverter_m: 10,
    routePreset: "technische schacht",
    routeDescription: "",
  });
  const [pickingExit, setPickingExit] = useState(false);

  // rail stock settings
  const [railStockSettings, setRailStockSettings] = useState<RailStockSettings>({
    stockLength_m: 6.0,
    minReusable_m: 2.0,
  });

  // selected products
  const selectedPanel = useMemo(() => panelsList.find((p) => p.id === selectedPanelId), [panelsList, selectedPanelId]);
  const selectedInv = useMemo(() => invertersList.find((p) => p.id === selectedInverterId), [invertersList, selectedInverterId]);

  // apply selected products to inputs
  const effectivePanel = useMemo(() => {
    if (!selectedPanel) return panel;
    return { ...panel, panelW_m: selectedPanel.width_m, panelH_m: selectedPanel.height_m, wp: selectedPanel.wp, voc: selectedPanel.voc_v };
  }, [panel, selectedPanel]);

  const effectiveInverter = useMemo(() => {
    if (!selectedInv) return inverter;
    return {
      ...inverter,
      brand: selectedInv.brand,
      model: selectedInv.model,
      vocMin: selectedInv.voc_min_v,
      vocMax: selectedInv.voc_max_v,
      mpptCount: selectedInv.mppt_count,
      stringsPerMppt: selectedInv.strings_per_mppt,
      mpptMinV: selectedInv.mppt_min_v,
      mpptMaxV: selectedInv.mppt_max_v,
      acPowerW: selectedInv.ac_power_w,
      maxDcPowerW: selectedInv.max_dc_power_w,
    };
  }, [inverter, selectedInv]);

  const keepouts = useMemo(() => buildKeepouts(obstacles), [obstacles]);

  const orientationResolved = useMemo(
    () => resolveOrientation(effectivePanel, roof, keepouts, targetCount, maximize),
    [effectivePanel, roof, keepouts, targetCount, maximize]
  );

  // base panels: start left-top (sorted)
  const basePanels = useMemo(() => {
    const all = orientationResolved.resolved === "portrait" ? orientationResolved.panelsPortrait : orientationResolved.panelsLandscape;
    const sorted = sortTopLeftFirst(all);
    const goal = maximize || !targetCount || targetCount <= 0 ? sorted.length : Math.min(targetCount, sorted.length);
    return sorted.slice(0, goal);
  }, [orientationResolved, targetCount, maximize]);

  // placed panels after click-removals
  const placedPanels = useMemo(() => basePanels.filter((_, i) => !removedBaseIdx.has(i)), [basePanels, removedBaseIdx]);

  const layout: LayoutResult = useMemo(() => {
    const rowsCount = countRows(placedPanels);
    const { rails, hooks } = calcRailsAndHooks(placedPanels, roof, mount);
    return { keepouts, panels: placedPanels, rowsCount, rails, hooks };
  }, [keepouts, placedPanels, roof, mount]);

  const maxPossible = useMemo(() => Math.max(orientationResolved.maxPortrait, orientationResolved.maxLandscape), [orientationResolved]);
  const totalWp = useMemo(() => layout.panels.length * (effectivePanel.wp || 0), [layout.panels.length, effectivePanel.wp]);

  const strings = useMemo(() => calcStrings(layout.panels.length, effectivePanel, effectiveInverter), [
    layout.panels.length,
    effectivePanel,
    effectiveInverter,
  ]);

  const cable = useMemo(() => calcCable(layout.panels, roof, strings.strings, cableSettings), [layout.panels, roof, strings.strings, cableSettings]);
  const railStock = useMemo(() => calcRailStock(layout.rails, railStockSettings), [layout.rails, railStockSettings]);

  function reapplyTarget() {
    setRemovedBaseIdx(new Set());
  }

  function togglePanel(idxInPlaced: number) {
    // map visible index -> base index (skip removed)
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
      <div className="topbar">
        <div className="brand">
          <img src="/Logo%20Standaard%20RGB.png" alt="Dural Bouwgroep" />
          <div className="brandTitle">
            <div className="title">PV Dossier</div>
            <div className="sub">V2.8</div>
          </div>
        </div>

        <div className="row">
          <button className={tab === "dossier" ? "btn" : "btnGhost"} onClick={() => setTab("dossier")}>
            Dossier
          </button>
          <button className={tab === "admin" ? "btn" : "btnGhost"} onClick={() => setTab("admin")}>
            Admin
          </button>

          <label className="muted" style={{ marginLeft: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={adminMode} onChange={(e) => setAdminMode(e.target.checked)} />
            admin mode (lokaal)
          </label>
        </div>
      </div>

      {tab === "admin" ? (
        <AdminProducts />
      ) : (
        <>
          {/* Bovenste deel: 2 kolommen */}
          <div className="grid">
            <div>
              <div className="card">
                <h3>Productkeuze</h3>

                <div className="grid2">
                  <label>
                    Paneel (merk/type)
                    <select
                      value={selectedPanelId}
                      onChange={(e) => {
                        setSelectedPanelId(e.target.value);
                        reapplyTarget();
                      }}
                    >
                      {panelsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.brand} – {p.model} ({p.wp}Wp)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Omvormer (merk/type)
                    <select value={selectedInverterId} onChange={(e) => setSelectedInverterId(e.target.value)}>
                      {invertersList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.brand} – {p.model} (Voc {p.voc_min_v}-{p.voc_max_v}V)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="muted">Users kiezen enkel producten. Admin beheert producten via tab Admin.</p>

                {adminMode && (
                  <div className="grid2" style={{ marginTop: 10 }}>
                    <label>
                      Paneel gap (m)
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
                  </div>
                )}
              </div>

              <div className="card">
                <h3>Dakvlak</h3>
                <div className="grid2">
                  <label>
                    Breedte (m)
                    <input type="number" step="0.01" value={roof.roofWidth_m} onChange={(e) => setRoof({ ...roof, roofWidth_m: +e.target.value })} />
                  </label>
                  <label>
                    Schuine zijde (m)
                    <input type="number" step="0.01" value={roof.slopedLength_m} onChange={(e) => setRoof({ ...roof, slopedLength_m: +e.target.value })} />
                  </label>
                  <label>
                    Marge (m)
                    <input type="number" step="0.01" value={roof.margin_m} onChange={(e) => setRoof({ ...roof, margin_m: +e.target.value })} />
                  </label>
                  <label>
                    Dakoriëntatie
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
                <h3>Panelen – plaatsing</h3>
                <div className="grid2">
                  <label>
                    Doel # panelen
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
                    Maximaliseer
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
                </div>

                <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                  <button className="btnGhost" onClick={() => setRemovedBaseIdx(new Set())}>
                    Reset weggeklikte panelen
                  </button>
                  <div className="muted">
                    Start: <b>links boven</b>. Klik paneel om te verwijderen.
                  </div>
                </div>

                <p className="muted" style={{ marginTop: 10 }}>
                  Max: Portrait {orientationResolved.maxPortrait} • Landscape {orientationResolved.maxLandscape} • Gekozen: <b>{orientationResolved.resolved}</b>
                  {!maximize && targetCount > maxPossible ? ` • ⚠ doel (${targetCount}) > max (${maxPossible})` : ""}
                </p>
              </div>

              <div className="card">
                <h3>Montage – haken/rails</h3>
                <div className="grid2">
                  <label>
                    Rails/rij
                    <input type="number" step="1" value={mount.railsPerRow} onChange={(e) => setMount({ ...mount, railsPerRow: +e.target.value })} />
                  </label>
                  <label>
                    Rail margin (m)
                    <input type="number" step="0.01" value={mount.railEdgeMargin_m} onChange={(e) => setMount({ ...mount, railEdgeMargin_m: +e.target.value })} />
                  </label>
                  <label>
                    Max haakafstand (m)
                    <input type="number" step="0.01" value={mount.maxHookSpacing_m} onChange={(e) => setMount({ ...mount, maxHookSpacing_m: +e.target.value })} />
                  </label>
                  <label>
                    Max eindafstand (m)
                    <input type="number" step="0.01" value={mount.maxEndDist_m} onChange={(e) => setMount({ ...mount, maxEndDist_m: +e.target.value })} />
                  </label>
                </div>
                <p className="muted" style={{ marginTop: 10 }}>Regels: max 20cm vanaf veld-einde • ~100cm tussen haken • keperlabels indicatief.</p>
              </div>

              <div className="card">
                <h3>Kabelroute</h3>
                <div className="grid2">
                  <label>
                    Exit point
                    <select value={cableSettings.exitMode} onChange={(e) => setCableSettings({ ...cableSettings, exitMode: e.target.value as any })}>
                      <option value="LT">Links boven</option>
                      <option value="RT">Rechts boven</option>
                      <option value="LB">Links onder</option>
                      <option value="RB">Rechts onder</option>
                      <option value="CUSTOM">Custom (klik)</option>
                    </select>
                  </label>

                  <label>
                    Slack (%)
                    <input type="number" step="1" value={cableSettings.slackPercent} onChange={(e) => setCableSettings({ ...cableSettings, slackPercent: +e.target.value })} />
                  </label>

                  <label>
                    Extra naar omvormer (m)
                    <input
                      type="number"
                      step="0.5"
                      value={cableSettings.extraToInverter_m}
                      onChange={(e) => setCableSettings({ ...cableSettings, extraToInverter_m: +e.target.value })}
                    />
                  </label>

                  <label>
                    Route preset
                    <select value={cableSettings.routePreset} onChange={(e) => setCableSettings({ ...cableSettings, routePreset: e.target.value as any })}>
                      <option value="achter afvoerbuis">Achter afvoerbuis</option>
                      <option value="technische schacht">Technische schacht</option>
                      <option value="via schouw">Via schouw</option>
                      <option value="via binnenzijde">Via binnenzijde</option>
                      <option value="anders">Anders</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 10 }}>
                  Beschrijving route
                  <textarea
                    rows={3}
                    value={cableSettings.routeDescription}
                    onChange={(e) => setCableSettings({ ...cableSettings, routeDescription: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </label>

                <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                  <button className="btnGhost" onClick={() => setPickingExit(true)} disabled={cableSettings.exitMode !== "CUSTOM"}>
                    Exit kiezen op plan
                  </button>
                  <div className="muted">
                    Dak: <b>{cable.totalOnRoof_m.toFixed(1)} m</b> • + extra: <b>{cableSettings.extraToInverter_m.toFixed(1)} m</b> • incl. {cableSettings.slackPercent}%:{" "}
                    <b>{cable.totalRecommended_m.toFixed(1)} m</b>
                  </div>
                </div>

                {cable.strings.length > 0 && (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Per string: {cable.strings.map((s) => `S${s.stringIndex}: ${s.lengthOnRoof_m.toFixed(1)}m`).join(" • ")}
                  </p>
                )}
              </div>

              <div className="card">
                <h3>Rails – stock 6m + afval</h3>
                <div className="grid2">
                  <label>
                    Stocklengte (m)
                    <input type="number" step="0.1" value={railStockSettings.stockLength_m} onChange={(e) => setRailStockSettings({ ...railStockSettings, stockLength_m: +e.target.value })} />
                  </label>
                  <label>
                    Min herbruikbaar (m)
                    <input type="number" step="0.1" value={railStockSettings.minReusable_m} onChange={(e) => setRailStockSettings({ ...railStockSettings, minReusable_m: +e.target.value })} />
                  </label>
                </div>

                <div className="kpis" style={{ marginTop: 10 }}>
                  <div><b>Totaal rail (m)</b>{railStock.totalRail_m.toFixed(1)}</div>
                  <div><b>Stuks</b>{railStock.stockPieces}</div>
                  <div><b>Totaal stock (m)</b>{railStock.stockTotal_m.toFixed(1)}</div>
                  <div><b>Afval (m)</b>{railStock.scrap_m.toFixed(1)}</div>
                  <div><b>Herbruikbaar (m)</b>{railStock.reusableOffcuts_m.toFixed(1)}</div>
                </div>

                <p className="muted" style={{ marginTop: 10 }}>Conservatief model: elk railsegment wordt uit stock gezaagd; rest &lt; min herbruikbaar = afval.</p>
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
                <div className="kpis" style={{ marginTop: 10 }}>
                  <div><b>Panelen</b>{layout.panels.length}</div>
                  <div><b>Vermogen</b>{totalWp} Wp</div>
                  <div><b>Rijen</b>{layout.rowsCount}</div>
                  <div><b>Rails</b>{layout.rails.length}</div>
                  <div><b>Haken</b>{layout.hooks.length}</div>
                  <div><b>Dak</b>{roof.azimuth}</div>
                </div>
              </div>

              <div className="card">
                <h3>Strings</h3>
                <div className="kpis" style={{ marginTop: 10 }}>
                  <div><b>nMin</b>{strings.nMin || "-"}</div>
                  <div><b>nMax</b>{strings.nMax || "-"}</div>
                  <div><b>Serie</b>{strings.nSeries ?? "-"}</div>
                  <div><b>#strings</b>{strings.strings.length || "-"}</div>
                  <div><b>Voc</b>{strings.vocString ? `${strings.vocString.toFixed(0)} V` : "-"}</div>
                  <div><b>Status</b>{strings.ok ? "OK" : "Check"}</div>
                </div>
                <p className="muted" style={{ marginTop: 10 }}>{strings.message}</p>
                {strings.strings.length > 0 && <p className="muted">Verdeling: {strings.strings.map((s, i) => `S${i + 1}: ${s}`).join(" • ")}</p>}
              </div>
            </div>
          </div>

          {/* Onderste deel: tekening FULL WIDTH */}
          <div className="card" style={{ marginTop: 14 }}>
            <h3>Plan – dakvlak, panelen, rails, haken, kabel</h3>
            <div className="muted" style={{ marginBottom: 10 }}>
              Tip: klik panelen om te verwijderen. Bij “Exit point = Custom” kan je het punt aanduiden op het plan.
            </div>

            <div style={{ width: "100%", overflowX: "auto" }}>
              <DrawingSvg
                roof={roof}
                layout={layout}
                cable={cable}
                onTogglePanel={togglePanel}
                pickingExit={pickingExit}
                onPickExit={(x, y) => {
                  setCableSettings({ ...cableSettings, exitCustom: { x, y } });
                  setPickingExit(false);
                }}
              />
            </div>

            <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
              <div className="muted">
                Tekening is nu <b>full width</b> voor betere leesbaarheid.
              </div>
              <button className="btnGhost" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Naar boven
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
