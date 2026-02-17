import React from "react";
import * as XLSX from "xlsx";
import {
  PanelProduct,
  InverterProduct,
  getPanels,
  getInverters,
  upsertPanels,
  upsertInverters,
  clearProducts,
  pushProductsToCloud,
  initProductsFromCloud,
} from "./products";

const LS_ADMIN_USER = "pv_admin_user_v1";
const LS_ADMIN_PASS = "pv_admin_pass_v1";

function norm(s: unknown) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");
}

function pick(row: Record<string, any>, keys: string[]) {
  const map = new Map<string, any>();
  for (const k of Object.keys(row)) map.set(norm(k), row[k]);
  for (const k of keys) {
    const v = map.get(norm(k));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function toNumber(v: any): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function parsePanels(rows: Record<string, any>[]): PanelProduct[] {
  const out: PanelProduct[] = [];

  for (const r of rows) {
    const brand = String(pick(r, ["brand", "merk", "fabrikant"]) ?? "").trim();
    const model = String(pick(r, ["model", "type", "naam", "name"]) ?? "").trim();
    if (!brand || !model) continue;

    const wp = toNumber(pick(r, ["wp", "pmax"])) ?? 0;
    const voc_v = toNumber(pick(r, ["voc", "voc_v"])) ?? 0;

    let width_m = toNumber(pick(r, ["width_m", "breedte_m"]));
    let height_m = toNumber(pick(r, ["height_m", "hoogte_m"]));

    const width_mm = toNumber(pick(r, ["width_mm", "breedte_mm"]));
    const height_mm = toNumber(pick(r, ["height_mm", "hoogte_mm"]));
    if (!width_m && width_mm) width_m = width_mm / 1000;
    if (!height_m && height_mm) height_m = height_mm / 1000;

    if (!wp || !voc_v || !width_m || !height_m) continue;

    const id = `${brand.trim()}|${model.trim()}`;

    out.push({
      id,
      brand,
      model,
      wp,
      voc_v,
      width_m,
      height_m,
      vmp_v: toNumber(pick(r, ["vmp_v", "vmpp", "vmp"])),
      imp_a: toNumber(pick(r, ["imp_a", "impp", "imp"])),
      notes: String(pick(r, ["notes", "opmerking", "opmerkingen"]) ?? "").trim() || undefined,
      datasheet_url: String(pick(r, ["datasheet_url", "datasheet", "url"]) ?? "").trim() || undefined,
    });
  }

  return Array.from(new Map(out.map((p) => [p.id, p])).values());
}

function parseInverters(rows: Record<string, any>[]): InverterProduct[] {
  const out: InverterProduct[] = [];

  for (const r of rows) {
    const brand = String(pick(r, ["brand", "merk", "fabrikant"]) ?? "").trim();
    const model = String(pick(r, ["model", "type", "naam", "name"]) ?? "").trim();
    if (!brand || !model) continue;

    const voc_min_v = toNumber(pick(r, ["voc_min_v", "vocmin", "min_dc_v", "dcmin"])) ?? 0;
    const voc_max_v = toNumber(pick(r, ["voc_max_v", "vocmax", "max_dc_v", "dcmax", "maxdc"])) ?? 0;
    if (!voc_min_v || !voc_max_v) continue;

    const id = `${brand.trim()}|${model.trim()}`;

    out.push({
      id,
      brand,
      model,
      voc_min_v,
      voc_max_v,
      mppt_min_v: toNumber(pick(r, ["mppt_min_v", "mpptmin"])),
      mppt_max_v: toNumber(pick(r, ["mppt_max_v", "mpptmax"])),
      mppt_count: toNumber(pick(r, ["mppt_count", "mppt_coun", "mpptcount", "aantalmppt"])),
      strings_per_mppt: toNumber(pick(r, ["strings_per_mppt", "strings_per", "stringspermppt", "strings"])),
      ac_power_w: toNumber(pick(r, ["ac_power_w", "ac_power_v", "acpower", "pac"])),
      max_dc_power_w: toNumber(pick(r, ["max_dc_power_w", "max_dc_po", "maxdcpower", "pdcmax"])),
      notes: String(pick(r, ["notes", "opmerking", "opmerkingen"]) ?? "").trim() || undefined,
      datasheet_url: String(pick(r, ["datasheet_url", "datasheet", "url"]) ?? "").trim() || undefined,
    });
  }

  return Array.from(new Map(out.map((p) => [p.id, p])).values());
}

async function readExcel(file: File): Promise<{ panels: PanelProduct[]; inverters: InverterProduct[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  let panels: PanelProduct[] = [];
  let inverters: InverterProduct[] = [];

  if (wb.Sheets["panels"]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets["panels"], { defval: "" });
    panels = parsePanels(rows);
  }

  if (wb.Sheets["inverters"]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets["inverters"], { defval: "" });
    inverters = parseInverters(rows);
  }

  // fallback: eerste sheet
  if (!panels.length && !inverters.length) {
    const sheetName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheetName], { defval: "" });
    panels = parsePanels(rows);
    inverters = parseInverters(rows);
  }

  return { panels, inverters };
}

export default function AdminProducts() {
  const [adminUser, setAdminUser] = React.useState(localStorage.getItem(LS_ADMIN_USER) ?? "");
  const [adminPass, setAdminPass] = React.useState(localStorage.getItem(LS_ADMIN_PASS) ?? "");

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const [importedPanels, setImportedPanels] = React.useState<PanelProduct[]>([]);
  const [importedInverters, setImportedInverters] = React.useState<InverterProduct[]>([]);

  const [localPanelsCount, setLocalPanelsCount] = React.useState(getPanels().length);
  const [localInvertersCount, setLocalInvertersCount] = React.useState(getInverters().length);

  function refreshLocalCounts() {
    setLocalPanelsCount(getPanels().length);
    setLocalInvertersCount(getInverters().length);
  }

  async function handleFile(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const { panels, inverters } = await readExcel(file);
      setImportedPanels(panels);
      setImportedInverters(inverters);
      setMsg(`✅ Excel gelezen. Panels: ${panels.length} — Inverters: ${inverters.length}.`);
    } catch (e: any) {
      setMsg(e?.message || "Excel import mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function importLocal() {
    setBusy(true);
    setMsg("");
    try {
      if (!importedPanels.length && !importedInverters.length) {
        throw new Error("Geen producten om te importeren (Excel bevatte niets herkenbaar).");
      }
      if (importedPanels.length) upsertPanels(importedPanels);
      if (importedInverters.length) upsertInverters(importedInverters);

      refreshLocalCounts();
      setMsg(`✅ Lokaal geïmporteerd. Local panels=${getPanels().length}, inverters=${getInverters().length}`);
    } catch (e: any) {
      setMsg(e?.message || "Import lokaal mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function pullCloud() {
    setBusy(true);
    setMsg("");
    try {
      await initProductsFromCloud();
      refreshLocalCounts();
      setMsg("✅ Cloud geladen naar lokaal (cache).");
    } catch (e: any) {
      setMsg(e?.message || "Cloud laden mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function pushCloud() {
    setBusy(true);
    setMsg("");
    try {
      if (!adminUser || !adminPass) throw new Error("Admin user/pass ontbreekt.");
      localStorage.setItem(LS_ADMIN_USER, adminUser);
      localStorage.setItem(LS_ADMIN_PASS, adminPass);

      await pushProductsToCloud(adminUser, adminPass);
      setMsg("✅ Naar cloud gepusht. Alle gebruikers krijgen nu dezelfde productlijst.");
    } catch (e: any) {
      setMsg(e?.message || "Push naar cloud mislukt");
    } finally {
      setBusy(false);
    }
  }

  function clearLocal() {
    clearProducts();
    setImportedPanels([]);
    setImportedInverters([]);
    refreshLocalCounts();
    setMsg("Local storage gewist (terug naar defaults).");
  }

  return (
    <div className="adminWrap">
      <h2 className="h2">Admin – Productbeheer</h2>
      <div className="muted" style={{ marginBottom: 12 }}>
        Flow: <b>Pull</b> → Excel upload → <b>Importeer lokaal</b> → <b>Push</b>. Zo heeft je collega exact dezelfde dropdowns.
      </div>

      <div className="card">
        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field">
            Admin user
            <input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="bv. admin4" />
          </label>

          <label className="field">
            Admin pass
            <input value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="••••••••" type="password" />
          </label>

          <button className="btnGhost" disabled={busy} onClick={pullCloud}>
            Pull from Cloud
          </button>

          <button className="btn" disabled={busy} onClick={pushCloud}>
            Push to Cloud
          </button>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>
          Local panels: <b>{localPanelsCount}</b> — Local inverters: <b>{localInvertersCount}</b>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Excel upload</div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="muted" style={{ marginTop: 10 }}>
              Parsed panels: <b>{importedPanels.length}</b> — Parsed inverters: <b>{importedInverters.length}</b>
            </div>
          </div>

          <div className="row" style={{ alignItems: "flex-end", gap: 10 }}>
            <button className="btnGhost" disabled={busy} onClick={importLocal}>
              Importeer lokaal (merge)
            </button>
            <button className="btnDanger" disabled={busy} onClick={clearLocal}>
              Clear lokaal
            </button>
          </div>
        </div>
      </div>

      {msg && <div className="msgBox">{msg}</div>}

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Preview panels (max 15)</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {importedPanels.slice(0, 15).map((p) => (
              <li key={p.id}>
                {p.brand} — {p.model} ({p.wp}Wp)
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Preview inverters (max 15)</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {importedInverters.slice(0, 15).map((p) => (
              <li key={p.id}>
                {p.brand} — {p.model} (DC {p.voc_min_v}-{p.voc_max_v}V)
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
