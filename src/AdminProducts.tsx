import React, { useMemo, useState } from "react";
import { parseCsv } from "./csv";
import { readXlsxFile, sheetToRows } from "./excel";
import {
  InverterProduct,
  PanelProduct,
  getInverters,
  getPanels,
  makeId,
  upsertInverters,
  upsertPanels,
} from "./products";

function num(v: any) {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

function normalizeKey(k: string) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeRowKeys(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

function toPanel(rowRaw: Record<string, any>): PanelProduct | null {
  const row = normalizeRowKeys(rowRaw);

  const brand = String(row["brand"] || row["merk"] || "").trim();
  const model = String(row["model"] || row["type"] || row["naam"] || "").trim();
  if (!brand || !model) return null;

  return {
    id: makeId(brand, model),
    brand,
    model,
    wp: num(row["wp"]),
    voc_v: num(row["voc_v"] || row["voc"]),
    vmp_v: row["vmp_v"] !== undefined && row["vmp_v"] !== "" ? num(row["vmp_v"]) : undefined,
    imp_a: row["imp_a"] !== undefined && row["imp_a"] !== "" ? num(row["imp_a"]) : undefined,
    width_m: num(row["width_m"]),
    height_m: num(row["height_m"]),
    notes: String(row["notes"] || row["opm"] || "").trim(),
    datasheet_url: String(row["datasheet_url"] || "").trim(),
  };
}

function toInverter(rowRaw: Record<string, any>): InverterProduct | null {
  const row = normalizeRowKeys(rowRaw);

  const brand = String(row["brand"] || row["merk"] || "").trim();
  const model = String(row["model"] || row["type"] || row["naam"] || "").trim();
  if (!brand || !model) return null;

  return {
    id: makeId(brand, model),
    brand,
    model,
    voc_min_v: num(row["voc_min_v"] || row["vocmin"]),
    voc_max_v: num(row["voc_max_v"] || row["vocmax"]),
    mppt_min_v: row["mppt_min_v"] !== undefined && row["mppt_min_v"] !== "" ? num(row["mppt_min_v"]) : undefined,
    mppt_max_v: row["mppt_max_v"] !== undefined && row["mppt_max_v"] !== "" ? num(row["mppt_max_v"]) : undefined,
    mppt_count: row["mppt_count"] !== undefined && row["mppt_count"] !== "" ? num(row["mppt_count"]) : undefined,
    strings_per_mppt:
      row["strings_per_mppt"] !== undefined && row["strings_per_mppt"] !== "" ? num(row["strings_per_mppt"]) : undefined,
    ac_power_w: row["ac_power_w"] !== undefined && row["ac_power_w"] !== "" ? num(row["ac_power_w"]) : undefined,
    max_dc_power_w:
      row["max_dc_power_w"] !== undefined && row["max_dc_power_w"] !== "" ? num(row["max_dc_power_w"]) : undefined,
    notes: String(row["notes"] || "").trim(),
    datasheet_url: String(row["datasheet_url"] || "").trim(),
  };
}

export default function AdminProducts() {
  const [active, setActive] = useState<"panels" | "inverters">("panels");
  const [csvText, setCsvText] = useState("");
  const [message, setMessage] = useState<string>("");

  const preview = useMemo(() => {
    if (!csvText.trim()) return [];
    return parseCsv(csvText);
  }, [csvText]);

  const stats = useMemo(() => {
    const errors: string[] = [];
    if (preview.length === 0) return { rows: 0, errors };

    if (active === "panels") {
      const mapped = preview.map(toPanel).filter(Boolean) as PanelProduct[];
      const bad = mapped.filter((p) => !p.wp || !p.voc_v || !p.width_m || !p.height_m);
      if (bad.length) errors.push(`${bad.length} panel-rij(en) missen wp/voc/afmetingen (import kan nog, maar check je data).`);
      return { rows: mapped.length, errors };
    } else {
      const mapped = preview.map(toInverter).filter(Boolean) as InverterProduct[];
      const bad = mapped.filter((p) => !p.voc_min_v || !p.voc_max_v);
      if (bad.length) errors.push(`${bad.length} omvormer-rij(en) missen voc_min_v/voc_max_v (import kan nog, maar check je data).`);
      return { rows: mapped.length, errors };
    }
  }, [preview, active]);

  function importCsvNow() {
    try {
      if (preview.length === 0) {
        setMessage("Geen data gevonden. Plak CSV en probeer opnieuw.");
        return;
      }
      if (active === "panels") {
        const mapped = preview.map(toPanel).filter(Boolean) as PanelProduct[];
        upsertPanels(mapped);
        setMessage(`OK: ${mapped.length} panelen geïmporteerd/updated via CSV. (Opslag: deze browser)`);
      } else {
        const mapped = preview.map(toInverter).filter(Boolean) as InverterProduct[];
        upsertInverters(mapped);
        setMessage(`OK: ${mapped.length} omvormers geïmporteerd/updated via CSV. (Opslag: deze browser)`);
      }
      setCsvText("");
    } catch (e: any) {
      setMessage(`Import fout: ${String(e?.message ?? e)}`);
    }
  }

  async function importXlsx(file: File) {
    try {
      const wb = await readXlsxFile(file);

      if (active === "panels") {
        const rows = sheetToRows(wb, "panels");
        if (rows.length === 0) {
          setMessage(`Excel import: tabblad "panels" niet gevonden of leeg. Controleer de sheetnaam exact.`);
          return;
        }
        const mapped = rows.map(toPanel).filter(Boolean) as PanelProduct[];
        upsertPanels(mapped);
        setMessage(`OK: ${mapped.length} panelen geïmporteerd uit Excel (tab: panels).`);
      } else {
        const rows = sheetToRows(wb, "inverters");
        if (rows.length === 0) {
          setMessage(`Excel import: tabblad "inverters" niet gevonden of leeg. Controleer de sheetnaam exact.`);
          return;
        }
        const mapped = rows.map(toInverter).filter(Boolean) as InverterProduct[];
        upsertInverters(mapped);
        setMessage(`OK: ${mapped.length} omvormers geïmporteerd uit Excel (tab: inverters).`);
      }
    } catch (e: any) {
      setMessage(`Excel import fout: ${String(e?.message ?? e)}`);
    }
  }

  const panelsCount = getPanels().length;
  const invertersCount = getInverters().length;

  return (
    <div className="card">
      <h3>Admin – Producten import (Excel of CSV)</h3>
      <p className="muted">
        Dit is Route A (lokaal): producten worden bewaard in <b>deze browser</b> (localStorage). Later kunnen we dit centraliseren via Cloudflare D1 + rollen.
      </p>

      <div className="row">
        <button className={active === "panels" ? "btn" : "btnGhost"} onClick={() => { setActive("panels"); setMessage(""); }}>
          Panelen ({panelsCount})
        </button>
        <button className={active === "inverters" ? "btn" : "btnGhost"} onClick={() => { setActive("inverters"); setMessage(""); }}>
          Omvormers ({invertersCount})
        </button>
      </div>

      <div className="row" style={{ marginTop: 10, alignItems: "center", gap: 10 }}>
        <label className="btnGhost" style={{ cursor: "pointer" }}>
          Excel (.xlsx) import
          <input
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importXlsx(f);
              // reset zodat je hetzelfde bestand opnieuw kan selecteren indien nodig
              (e.currentTarget as HTMLInputElement).value = "";
            }}
          />
        </label>
        <div className="muted">
          Verwacht sheetnaam: <b>{active === "panels" ? "panels" : "inverters"}</b>
        </div>
      </div>

      <hr style={{ margin: "14px 0" }} />

      <p className="muted">
        CSV kan ook: plak je CSV hieronder en klik "Importeer CSV". (Excel → Opslaan als CSV → open CSV → copy/paste)
      </p>

      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        rows={10}
        placeholder={
          active === "panels"
            ? "brand,model,wp,voc_v,vmp_v,imp_a,width_m,height_m,notes,datasheet_url\nAIKO,Neostar 3S+ 450,450,49.5,41.2,10.9,1.134,1.722,\"\",\"\""
            : "brand,model,voc_min_v,voc_max_v,mppt_min_v,mppt_max_v,mppt_count,strings_per_mppt,ac_power_w,max_dc_power_w,notes,datasheet_url\nHuawei,SUN2000-6KTL-M1,200,600,90,560,2,1,6000,9000,\"\",\"\""
        }
        style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
      />

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={importCsvNow}>
          Importeer CSV
        </button>
        <div className="muted">
          Preview: {stats.rows} rij(en){stats.errors.length ? ` • ⚠ ${stats.errors.join(" ")}` : ""}
        </div>
      </div>

      {message && (
        <p className="muted" style={{ marginTop: 10 }}>
          <b>{message}</b>
        </p>
      )}
    </div>
  );
}
