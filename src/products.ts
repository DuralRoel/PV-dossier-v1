export type PanelProduct = {
  id: string;          // brand|model
  brand: string;
  model: string;
  wp: number;
  voc_v: number;
  vmp_v?: number;
  imp_a?: number;
  width_m: number;
  height_m: number;
  notes?: string;
  datasheet_url?: string;
};

export type InverterProduct = {
  id: string;          // brand|model
  brand: string;
  model: string;
  voc_min_v: number;
  voc_max_v: number;
  mppt_min_v?: number;
  mppt_max_v?: number;
  mppt_count?: number;
  strings_per_mppt?: number;
  ac_power_w?: number;
  max_dc_power_w?: number;
  notes?: string;
  datasheet_url?: string;
};

const LS_PANELS = "pv_products_panels_v1";
const LS_INVERTERS = "pv_products_inverters_v1";

function safeJsonParse<T>(s: string | null, fallback: T): T {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}

export function makeId(brand: string, model: string) {
  return `${brand.trim()}|${model.trim()}`;
}

export function defaultPanels(): PanelProduct[] {
  return [
    {
      id: makeId("AIKO", "Neostar 3S+ 450"),
      brand: "AIKO",
      model: "Neostar 3S+ 450",
      wp: 450,
      voc_v: 49.5,
      vmp_v: 41.2,
      imp_a: 10.9,
      width_m: 1.134,
      height_m: 1.722,
      notes: "Voorbeeldproduct (kan vervangen worden via CSV import).",
    },
  ];
}

export function defaultInverters(): InverterProduct[] {
  return [
    {
      id: makeId("Huawei", "SUN2000-6KTL-M1"),
      brand: "Huawei",
      model: "SUN2000-6KTL-M1",
      voc_min_v: 200,
      voc_max_v: 600,
      mppt_min_v: 90,
      mppt_max_v: 560,
      mppt_count: 2,
      strings_per_mppt: 1,
      ac_power_w: 6000,
      max_dc_power_w: 9000,
      notes: "Voorbeeldproduct (kan vervangen worden via CSV import).",
    },
  ];
}

export function getPanels(): PanelProduct[] {
  return safeJsonParse<PanelProduct[]>(localStorage.getItem(LS_PANELS), defaultPanels());
}

export function getInverters(): InverterProduct[] {
  return safeJsonParse<InverterProduct[]>(localStorage.getItem(LS_INVERTERS), defaultInverters());
}

export function savePanels(items: PanelProduct[]) {
  localStorage.setItem(LS_PANELS, JSON.stringify(items));
}

export function saveInverters(items: InverterProduct[]) {
  localStorage.setItem(LS_INVERTERS, JSON.stringify(items));
}

export function upsertPanels(items: PanelProduct[]) {
  const existing = getPanels();
  const map = new Map(existing.map(p => [p.id, p]));
  for (const it of items) map.set(it.id, it);
  savePanels(Array.from(map.values()).sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model)));
}

export function upsertInverters(items: InverterProduct[]) {
  const existing = getInverters();
  const map = new Map(existing.map(p => [p.id, p]));
  for (const it of items) map.set(it.id, it);
  saveInverters(Array.from(map.values()).sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model)));
}

export function clearProducts() {
  localStorage.removeItem(LS_PANELS);
  localStorage.removeItem(LS_INVERTERS);
}
