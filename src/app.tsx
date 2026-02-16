import React, { useMemo, useState } from "react";
import type { MountingInput, Obstacle, PanelInput, RoofInput, LayoutResult } from "./types";
import ObstaclesTable from "./components/ObstaclesTable";
import { DrawingSvg } from "./components/DrawingSvg";
import { buildKeepouts, autoFillPanels, countRows } from "./utils/layoutPanels";
import { calcRailsAndHooks } from "./utils/calcRailsHooks";

const DEFAULTS = {
  roof: {
    roofWidth_m: 8,
    slopedLength_m: 5,
    margin_m: 0.20,
    rafterSpacing_m: 0.60,
    rafterOffset_m: 0.00,
  } as RoofInput,

  panel: {
    panelW_m: 1.134,
    panelH_m: 1.722,
    orientation: "portrait",
    gap_m: 0.02,
  } as PanelInput,

  mount: {
    railsPerRow: 2,
    railEdgeMargin_m: 0.12,
    maxHookSpacing_m: 1.00,
    maxEndDist_m: 0.20,
    snapTol_m: 0.35,
  } as MountingInput,

  obstacles: [
    { id: "velux1", type: "VELUX", x_m: 2.6, y_m: 1.2, w_m: 0.78, h_m: 1.18, buffer_m: 0.20 },
    { id: "schouw1", type: "SCHOUW", x_m: 5.2, y_m: 2.2, w_m: 0.60, h_m: 0.60, buffer_m: 0.30 },
  ] as Obstacle[],
};

export default function App() {
  const [roof, setRoof] = useState<RoofInput>(DEFAULTS.roof);
  const [panel, setPanel] = useState<PanelInput>(DEFAULTS.panel);
  const [mount, setMount] = useState<MountingInput>(DEFAULTS.mount);
  const [obstacles, setObstacles] = useState<Obstacle[]>(DEFAULTS.obstacles);

  const layout: LayoutResult = useMemo(() => {
    const keepouts = buildKeepouts(obstacles);
    const panels = autoFillPanels(roof, panel, keepouts);
    const rowsCount = countRows(panels);

    const { rails, hooks } = calcRailsAndHooks(panels, roof, mount);

    return { keepouts, panels, rowsCount, rails, hooks };
  }, [roof, panel, mount, obstacles]);

  return (
    <div className="page">
      <h2>PV Technisch Dossier – V2.3 (functioneel)</h2>

      <div className="grid">
        {/* LEFT: Inputs */}
        <div>
          <div className="card">
            <h3>Dakvlak</h3>
            <div className="grid2">
              <label>Breedte (m)
                <input type="number" step="0.01" value={roof.roofWidth_m}
                  onChange={e => setRoof({ ...roof, roofWidth_m: +e.target.value })} />
              </label>

              <label>Schuine zijde (plan) (m)
                <input type="number" step="0.01" value={roof.slopedLength_m}
                  onChange={e => setRoof({ ...roof, slopedLength_m: +e.target.value })} />
              </label>

              <label>Marge / brandstrook (m)
                <input type="number" step="0.01" value={roof.margin_m}
                  onChange={e => setRoof({ ...roof, margin_m: +e.target.value })} />
              </label>

              <label>Keperafstand (m)
                <input type="number" step="0.01" value={roof.rafterSpacing_m}
                  onChange={e => setRoof({ ...roof, rafterSpacing_m: +e.target.value })} />
              </label>

              <label>Keper offset (m)
                <input type="number" step="0.01" value={roof.rafterOffset_m}
                  onChange={e => setRoof({ ...roof, rafterOffset_m: +e.target.value })} />
              </label>
            </div>
            <p className="muted">
              V2.3 tekent het dakvlak als plan-rechthoek. In V2.4 maken we trapezium/parallellogram mogelijk.
            </p>
          </div>

          <div className="card">
            <h3>Paneel</h3>
            <div className="grid2">
              <label>Paneel breedte (m)
                <input type="number" step="0.001" value={panel.panelW_m}
                  onChange={e => setPanel({ ...panel, panelW_m: +e.target.value })} />
              </label>

              <label>Paneel hoogte (m)
                <input type="number" step="0.001" value={panel.panelH_m}
                  onChange={e => setPanel({ ...panel, panelH_m: +e.target.value })} />
              </label>

              <label>Oriëntatie
                <select value={panel.orientation}
                  onChange={e => setPanel({ ...panel, orientation: e.target.value as any })}>
                  <option value="portrait">portrait</option>
                  <option value="landscape">landscape</option>
                </select>
              </label>

              <label>Tussenafstand (m)
                <input type="number" step="0.001" value={panel.gap_m}
                  onChange={e => setPanel({ ...panel, gap_m: +e.target.value })} />
              </label>
            </div>
          </div>

          <div className="card">
            <h3>Montage – rails & haken</h3>
            <div className="grid2">
              <label>Rails per rij
                <input type="number" step="1" value={mount.railsPerRow}
                  onChange={e => setMount({ ...mount, railsPerRow: +e.target.value })} />
              </label>

              <label>Rail marge L/R (m)
                <input type="number" step="0.01" value={mount.railEdgeMargin_m}
                  onChange={e => setMount({ ...mount, railEdgeMargin_m: +e.target.value })} />
              </label>

              <label>Max afstand tussen haken (m)
                <input type="number" step="0.01" value={mount.maxHookSpacing_m}
                  onChange={e => setMount({ ...mount, maxHookSpacing_m: +e.target.value })} />
              </label>

              <label>Max afstand tot einde (m)
                <input type="number" step="0.01" value={mount.maxEndDist_m}
                  onChange={e => setMount({ ...mount, maxEndDist_m: +e.target.value })} />
              </label>

              <label>Snap tolerantie keper (m)
                <input type="number" step="0.01" value={mount.snapTol_m}
                  onChange={e => setMount({ ...mount, snapTol_m: +e.target.value })} />
              </label>
            </div>

            <p className="muted">
              Jouw regels staan standaard goed: <b>20cm</b> van het einde, <b>±100cm</b> tussen haken, en we tonen
              de <b>dichtste keper</b> (K-index + X-positie). Rood = haak kon niet snappen.
            </p>
          </div>

          <ObstaclesTable obstacles={obstacles} onChange={setObstacles} />
        </div>

        {/* RIGHT: Result */}
        <div>
          <div className="card">
            <h3>Resultaat (V2.3)</h3>
            <div className="kpis">
              <div><b>Panelen</b>{layout.panels.length}</div>
              <div><b>Rijen</b>{layout.rowsCount}</div>
              <div><b>Rails</b>{layout.rails.length}</div>
              <div><b>Haken</b>{layout.hooks.length}</div>
            </div>
            <p className="muted">
              Dit is het hakenplan op basis van panelveld per rij. In V2.4+ voegen we uitzonderingsregels toe per montagesysteem.
            </p>
          </div>

          <div className="card">
            <h3>Tekening</h3>
            <div style={{ height: 640 }}>
              <DrawingSvg roof={roof} layout={layout} />
            </div>
            <p className="muted">
              Tip: zet je keperafstand/offset correct — dan zie je bij elke haak “K.. (x=..m)” verschijnen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

