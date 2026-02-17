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

    const wp = toNumber(pick(r, ["wp", "pmax"])) ?? 0;
    const voc_v = toNumber(pick(r, ["voc", "voc_v"])) ?? 0;
    const width_m = toNumber(pick(r, ["width_m"])) ?? 0;
    const height_m = toNumber(pick(r, ["height_m"])) ?? 0;

    if (!wp || !voc_v || !width_m || !height_m) continue;

    out.push({
      id: makeId(brand, model),
      brand,
      model,
      wp,
      voc_v,
      width_m,
      height_m,
    });
  }

  return Array.from(new Map(out.map(p => [p.id, p])).values());
}

function parseInverters(rows: Record<string, any>[]): InverterProduct[] {
  const out: InverterProduct[] = [];

  for (const r of rows) {
    const brand = String(pick(r, ["brand", "merk"]) ?? "").trim();
    const model = String(pick(r, ["model", "type"]) ?? "").trim();
    if (!brand || !model) continue;

    const voc_min_v = toNumber(pick(r, ["voc_min_v", "voc_min"])) ?? 0;
    const voc_max_v = toNumber(pick(r, ["voc_max_v", "voc_max"])) ?? 0;
    if (!voc_min_v || !voc_max_v) continue;

    out.push({
      id: makeId(brand, model),
      brand,
      model,
      voc_min_v,
      voc_max_v,
      mppt_min_v: toNumber(pick(r, ["mppt_min_v"])),
      mppt_max_v: toNumber(pick(r, ["mppt_max_v"])),
      mppt_count: toNumber(pick(r, ["mppt_count"])),
      strings_per_mppt: toNumber(pick(r, ["strings_per_mppt"])),
      ac_power_w: toNumber(pick(r, ["ac_power_w"])),
      max_dc_power_w: toNumber(pick(r, ["max_dc_power_w"])),
    });
  }

  return Array.from(new Map(out.map(p => [p.id, p])).values());
}

async function readExcel(file: File) {
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

  // fallback indien geen named sheets
  if (!panels.length && !inverters.length) {
    const sheetName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheetName], { defval: "" });
    panels = parsePanels(rows);
    inverters = parseInverters(rows);
  }

  return { panels, inverters };
}

export default function AdminProducts() {
  const [msg, setMsg] = React.useState("");

  async function handleFile(file: File) {
    try {
      const { panels, inverters } = await readExcel(file);
      upsertPanels(panels);
      upsertInverters(inverters);
      setMsg(`✅ Panels: ${panels.length} — Inverters: ${inverters.length} geïmporteerd`);
    } catch (e: any) {
      setMsg(e?.message || "Import mislukt");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Admin – Excel Import</h2>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {msg && <div style={{ marginTop: 12 }}>{msg}</div>}
    </div>
  );
}
