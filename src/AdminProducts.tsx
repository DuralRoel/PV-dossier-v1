import React from "react";
import * as XLSX from "xlsx";
import {
  PanelProduct,
  InverterProduct,
  makeId,
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

    const wp = toNumber(pick(r, ["wp", "pmax", "vermogenwp"])) ?? 0;
    const voc_v = toNumber(pick(r, ["voc", "voc_v", "opencircuitvoltage", "openklemspanning"])) ?? 0;

    const vmp_v = toNumber(pick(r, ["vmpp", "vmp", "vmp_v", "mppvoltage"]));
    const imp_a = toNumber(pick(r, ["impp", "imp", "imp_a", "mppcurrent"]));

    // Excel kan mm of m bevatten — we proberen beide
    let width_m = toNumber(pick(r, ["width_m", "breedte_m", "widthm"])) ?? undefined;
    let height_m = toNumber(pick(r, ["height_m", "hoogte_m", "heightm"])) ?? undefined;

    const width_mm = toNumber(pick(r, ["width_mm", "breedte_mm", "widthmm", "breedtemm"]));
    const height_mm = toNumber(pick(r, ["height_mm", "hoogte_mm", "heightmm", "hoogtemm"]));

    if (!width_m && width_mm) width_m = width_mm / 1000;
    if (!height_m && height_mm) height_m = height_mm / 1000;

    const notes = String(pick(r, ["notes", "opmerking", "opmerkingen"]) ?? "").trim() || undefined;
    const datasheet_url = String(pick(r, ["datasheet_url", "datasheet", "url"]) ?? "").trim() || undefined;

    // minimale validatie
    if (!wp || !voc_v || !width_m || !height_m) continue;

    out.push({
      id: makeId(brand, model),
      brand,
      model,
      wp,
      voc_v,
      vmp_v,
      imp_a,
      width_m,
      height_m,
      notes,
      datasheet_url,
    });
  }

  // dedupe op id
  const byId = new Map<string, PanelProduct>();
  for (const p of out) byId.set(p.id, p);
  return Array.from(byId.values());
}

function parseInverters(rows: Record<string, any>[]): InverterProduct[] {
  const out: InverterProduct[] = [];

  for (const r of rows) {
    const brand = String(pick(r, ["brand", "merk", "fabrikant"]) ?? "").trim();
    const model = String(pick(r, ["model", "type", "naam", "name"]) ?? "").trim();
    if (!brand || !model) continue;

    const voc_min_v = toNumber(pick(r, ["voc_min_v", "vdcmin", "min_dc_v", "minDC", "dcmin"])) ?? 0;
    const voc_max_v = toNumber(pick(r, ["voc_max_v", "vdcmax", "max_dc_v", "maxDC", "dcmax", "maxdc"])) ?? 0;

    const mppt_min_v = toNumber(pick(r, ["mppt_min_v", "mpptmin", "mpptminv"]));
    const mppt_max_v = toNumber(pick(r, ["mppt_max_v", "mpptmax", "mpptmaxv"]));
    const mppt_count = toNumber(pick(r, ["mppt_count", "aantalmppt", "mpptcount"]));
    const strings_per_mppt = toNumber(pick(r, ["strings_per_mppt", "stringspermppt", "strings"]));
    const ac_power_w = toNumber(pick(r, ["ac_power_w", "acpower", "pac", "vermogenac"]));
    const max_dc_power_w = toNumber(pick(r, ["max_dc_power_w", "maxdcpower", "pdcmax", "maxdcvermogen"]));

    const notes = String(pick(r, ["notes", "opmerking", "opmerkingen"]) ?? "").trim() || undefined;
    const datasheet_url = String(pick(r, ["datasheet_url", "datasheet", "url"]) ?? "").trim() || undefined;

    if (!voc_min_v || !voc_max_v) continue;

    out.push({
      id: makeId(brand, model),
      brand,
      model,
      voc_min_v,
      voc_max_v,
      mppt_min_v,
      mppt_max_v,
      mppt_count: mppt_count ? Math.round(mppt_count) : undefined,
      strings_per_mppt: strings_per_mppt ? Math.round(strings_per_mppt) : undefined,
      ac_power_w,
      max_dc_power_w,
      notes,
      datasheet_url,
    });
  }

  const byId = new Map<string, InverterProduct>();
  for (const p of out) byId.set(p.id, p);
  return Array.from(byId.values());
}

async function readExcel(file: File): Promise<{ panels: PanelProduct[]; inverters: InverterProduct[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // we nemen sheet1 als basis — als je later “Panels”/“Inverters” tabs gebruikt kunnen we uitbreiden
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

  // We proberen uit dezelfde sheet zowel panels als inverters te detecteren
  // op basis van aanwezige kolommen.
  const hasPanelCols =
    rows.length &&
    (Object.keys(rows[0]).some((k) => norm(k).includes("wp")) ||
      Object.keys(rows[0]).some((k) => norm(k).includes("voc")));

  const hasInverterCols =
    rows.length &&
    (Object.keys(rows[0]).some((k) => norm(k).includes("mppt")) ||
      Object.keys(rows[0]).some((k) => norm(k).includes("ac_power")) ||
      Object.keys(rows[0]).some((k) => norm(k).includes("voc_min")));

  const panels = hasPanelCols ? parsePanels(rows) : [];
  const inverters = hasInverterCols ? parseInverters(rows) : [];

  return { panels, inverters };
}

export default function AdminProducts() {
  const [adminUser, setAdminUser] = React.useState(localStorage.getItem(LS_ADMIN_USER) ?? "");
  const [adminPass, setAdminPass] = React.useState(localStorage.getItem(LS_ADMIN_PASS) ?? "");

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");

  const [importedPanels, setImportedPanels] = React.useState<PanelProduct[]>([]);
  const [importedInverters, setImportedInverters] = React.useState<InverterProduct[]>([]);

  const [localPanelsCount, setLocalPanelsCount] = React.useState(getPanels().length);
  const [localInvertersCount, setLocalInvertersCount] = React.useState(getInverters().length);

  async function refreshLocalCounts() {
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

      setMsg(
        `Excel gelezen. Panels: ${panels.length} — Inverters: ${inverters.length}. ` +
          `Klik "Importeer lokaal" om samen te voegen.`
      );
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

      await refreshLocalCounts();
      setMsg(`✅ Lokaal geïmporteerd. Local panels=${getPanels().length}, inverters=${getInverters().length}`);
    } catch (e: any) {
      setMsg(e?.message || "Import lokaal mislukt");
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

  async function pullCloud() {
    setBusy(true);
    setMsg("");
    try {
      await initProductsFromCloud();
      await refreshLocalCounts();
      setMsg("✅ Cloud geladen naar lokaal (cache).");
    } catch (e: any) {
      setMsg(e?.message || "Cloud laden mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function clearLocal() {
    clearProducts();
    await refreshLocalCounts();
    setImportedPanels([]);
    setImportedInverters([]);
    setMsg("Local storage gewist (terug naar defaults).");
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h2 style={{ margin: "0 0 6px" }}>Admin – Productbeheer</h2>
      <div style={{ opacity: 0.75, marginBottom: 16 }}>
        Excel import → lokaal samenvoegen → push naar Cloudflare KV. Users zien automatisch dezelfde dropdown items.
      </div>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={label}>
            Admin user
            <input
              style={input}
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
              placeholder="bv. admin4"
            />
          </label>

          <label style={label}>
            Admin pass
            <input
              style={input}
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              placeholder="••••••••"
              type="password"
            />
          </label>

          <button style={btn} disabled={busy} onClick={pullCloud}>
            Pull from Cloud
          </button>

          <button style={btnPrimary} disabled={busy} onClick={pushCloud}>
            Push to Cloud
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.8 }}>
          Local panels: <b>{localPanelsCount}</b> — Local inverters: <b>{localInvertersCount}</b>
        </div>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
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
            <div style={{ marginTop: 10, opacity: 0.8 }}>
              Parsed panels: <b>{importedPanels.length}</b> — Parsed inverters: <b>{importedInverters.length}</b>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <button style={btn} disabled={busy} onClick={importLocal}>
              Importeer lokaal (merge)
            </button>
            <button style={btnDanger} disabled={busy} onClick={clearLocal}>
              Clear lokaal
            </button>
          </div>
        </div>
      </div>

      {msg && <div style={msgBox}>{msg}</div>}

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={box}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Preview panels (max 15)</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {importedPanels.slice(0, 15).map((p) => (
              <li key={p.id}>
                {p.brand} — {p.model} ({p.wp}Wp)
              </li>
            ))}
          </ul>
        </div>

        <div style={box}>
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

const box: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
};

const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const input: React.CSSProperties = {
  height: 38,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.20)",
  minWidth: 220,
};

const btn: React.CSSProperties = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.20)",
  background: "#fff",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "#111827",
  color: "#fff",
};

const btnDanger: React.CSSProperties = {
  ...btn,
  background: "#991b1b",
  color: "#fff",
  border: "1px solid rgba(0,0,0,0.10)",
};

const msgBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 10,
  background: "#fff",
};

