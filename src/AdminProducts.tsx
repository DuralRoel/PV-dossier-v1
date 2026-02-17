import React, { useMemo, useState } from "react";
import { parseCsv } from "./csv";
import { InverterProduct, PanelProduct, getInverters, getPanels, makeId, upsertInverters, upsertPanels } from "./products";

function num(v: string) {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

function toPanel(row: Record<string, string>): PanelProduct | null {
  const brand = row["brand"] || row["merk"] || "";
  const model = row["model"] || row["type"] || row["naam"] || "";
  if (!brand || !model) return null;

  return {
    id: makeId(brand, model),
    brand,
    model,
    wp: num(row["wp"]),
    voc_v: num(row["voc_v"] || row["voc"]),
    vmp_v: row["vmp_v"] ? num(row["vmp_v"]) : undefined,
    imp_a: row["imp_a"] ? num(row["imp_a"]) : undefined,
    width_m: num(row["width_m"]),
    height_m: num(row["height_m"]),
    notes: row["notes"] || row["opm"] || "",
    datasheet_url: row["datasheet_url"] || "",
  };
}

function toInverter(row: Record<string, string>): InverterProduct | null {
  const brand = row["brand"] || row["merk"] || "";
  const model = row["model"] || row["type"] || row["naam"] || "";
  if (!brand || !model) return null;

  return {
    id: makeId(brand, model),
    brand,
    model,
    voc_min_v: num(row["voc_min_v"] || row["vocmin"]),
    voc_max_v: num(row["voc_max_v"] || row["vocmax"]),
    mppt_min_v: row["mppt_min_v"] ? num(row["mppt_min_v"]) : undefined,
    mppt_max_v: row["mppt_max_v"] ? num(row["mppt_max_v"]) : undefined,
    mppt_count: row["mppt_count"] ? num(row["mppt_count"]) : undefined,
    strings_per_mppt: row["strings_per_mppt"] ? num(row["strings_per_mppt"]) : undefined,
    ac_power_w: row["ac_power_w"] ? num(row["ac_power_w"]) : undefined,
    max_dc_power_w: row["max_dc_power_w"] ? num(row["max_dc_power_w"]) : undefined,
    notes: row["notes"] || "",
    datasheet_url: row["datasheet_url"] || "",
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
      const bad = mapped.filter(p => !p.wp || !p.voc_v || !p.width_m || !p.height_m);
      if (bad.length) errors.push(`${bad.length} panel-rij(en) missen wp/voc/afmetingen (import kan nog, maar check je CSV).`);
      return { rows: mapped.length, errors };
    } else {
      const mapped = preview.map(toInverter).filter(Boolean) as InverterProduct[];
      const bad = mapped.filter(p => !p.voc_min_v || !p.voc_max_v);
      if (bad.length) errors.push(`${bad.length} omvormer-rij(en) missen voc_min_v/voc_max_v (import kan nog, maar check je CSV).`);
      return { rows: mapped.length, errors };
    }
  }, [preview, active]);

  function importNow() {
    try {
      if (preview.length === 0) {
        setMessage("Geen data gevonden. Plak CSV en probeer opnieuw.");
        return;
      }
      if (active === "panels") {
        const mapped = preview.map(toPanel).filter(Boolean) as PanelProduct[];
        upsertPanels(mapped);
        setMessage(`OK: ${mapped.length} panelen geïmporteerd/updated. (Opslag: deze browser)`);
      } else {
        const mapped = preview.map(toInverter).filter(Boolean) as InverterProduct[];
        upsertInverters(mapped);
        setMessage(`OK: ${mapped.length} omvormers geïmporteerd/updated. (Opslag: deze browser)`);
      }
      setCsvText("");
    } catch (e: any) {
      setMessage(`Import fout: ${String(e?.message ?? e)}`);
    }
  }

  const panelsCount = getPanels().length;
  const invertersCount = getInverters().length;

  return (
    <div className="card">
      <h3>Admin – Producten (CSV import – Route A)</h3>
      <p className="muted">
        V2.8 oplossing: producten worden bewaard in <b>deze browser</b> (localStorage). Later kunnen we migreren naar Cloudflare D1 + echte rollen.
      </p>

      <div className="row">
        <button className={active === "panels" ? "btn" : "btnGhost"} onClick={() => { setActive("panels"); setMessage(""); }}>
          Panelen ({panelsCount})
        </button>
        <button className={active === "inverters" ? "btn" : "btnGhost"} onClick={() => { setActive("inverters"); setMessage(""); }}>
          Omvormers ({invertersCount})
        </button>
      </div>

      <p className="muted" style={{ marginTop: 10 }}>
        Plak de volledige inhoud van je CSV hieronder (Excel → Opslaan als CSV → open CSV → kopieer alles).
      </p>

      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        rows={10}
        placeholder={active === "panels"
          ? "brand,model,wp,voc_v,vmp_v,imp_a,width_m,height_m,notes,datasheet_url\nAIKO,Neostar 3S+ 450,450,49.5,41.2,10.9,1.134,1.722,\"\",\"\""
          : "brand,model,voc_min_v,voc_max_v,mppt_min_v,mppt_max_v,mppt_count,strings_per_mppt,ac_power_w,max_dc_power_w,notes,datasheet_url\nHuawei,SUN2000-6KTL-M1,200,600,90,560,2,1,6000,9000,\"\",\"\""
        }
        style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
      />

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={importNow}>Importeer CSV</button>
        <div className="muted">
          Preview: {stats.rows} rij(en){stats.errors.length ? ` • ⚠ ${stats.errors.join(" ")}` : ""}
        </div>
      </div>

      {message && <p className="muted" style={{ marginTop: 10 }}><b>{message}</b></p>}
    </div>
  );
}
