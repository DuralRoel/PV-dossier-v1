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

type CloudPayload = {
  version: string;
  updatedAt: string;
  panels: PanelProduct[];
  inverters: InverterProduct[];
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
      notes: "Voorbeeldproduct (kan vervangen worden via admin import).",
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
      notes: "Voorbeeldproduct (kan vervangen worden via admin import).",
    },
  ];
}

// --- interne cache (zodat je app sync kan blijven werken) ---
let cachePanels: PanelProduct[] = safeJsonParse<PanelProduct[]>(localStorage.getItem(LS_PANELS), defaultPanels());
let cacheInverters: InverterProduct[] = safeJsonParse<InverterProduct[]>(localStorage.getItem(LS_INVERTERS), defaultInverters());

function setCache(panels: PanelProduct[], inverters: InverterProduct[]) {
  cachePanels = panels?.length ? panels : defaultPanels();
  cacheInverters = inverters?.length ? inverters : defaultInverters();
  localStorage.setItem(LS_PANELS, JSON.stringify(cachePanels));
  localStorage.setItem(LS_INVERTERS, JSON.stringify(cacheInverters));
}

// --- PUBLIC: bestaande sync API blijft werken ---
export function getPanels(): PanelProduct[] {
  return cachePanels;
}

export function getInverters(): InverterProduct[] {
  return cacheInverters;
}

export function savePanels(items: PanelProduct[]) {
  cachePanels = items;
  localStorage.setItem(LS_PANELS, JSON.stringify(items));
}

export function saveInverters(items: InverterProduct[]) {
  cacheInverters = items;
  localStorage.setItem(LS_INVERTERS, JSON.stringify(items));
}

export function upsertPanels(items: PanelProduct[]) {
  const map = new Map(getPanels().map(p => [p.id, p]));
  for (const it of items) map.set(it.id, it);
  const merged = Array.from(map.values()).sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model));
  savePanels(merged);
}

export function upsertInverters(items: InverterProduct[]) {
  const map = new Map(getInverters().map(p => [p.id, p]));
  for (const it of items) map.set(it.id, it);
  const merged = Array.from(map.values()).sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model));
  saveInverters(merged);
}

export function clearProducts() {
  localStorage.removeItem(LS_PANELS);
  localStorage.removeItem(LS_INVERTERS);
  cachePanels = defaultPanels();
  cacheInverters = defaultInverters();
}

// --- NIEUW: laad centrale lijst (KV) bij start ---
export async function initProductsFromCloud() {
  // fallback is al in cache, we proberen cloud erover te zetten
  const res = await fetch("/api/products", { cache: "no-store" });
  if (!res.ok) return;

  const data = (await res.json()) as CloudPayload;
  if (!data) return;

  setCache(data.panels ?? [], data.inverters ?? []);
}

// --- NIEUW: admin push naar cloud (KV) ---
export async function pushProductsToCloud(adminUser: string, adminPass: string) {
  const auth = btoa(`${adminUser}:${adminPass}`);

  const payload: Omit<CloudPayload, "updatedAt"> = {
    version: "1.0",
    panels: getPanels(),
    inverters: getInverters(),
  };

  const res = await fetch("/api/products", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Push naar cloud mislukt");
  }

  // na succesvolle push: opnieuw laden zodat cache exact overeenkomt met cloud
  await initProductsFromCloud();
}
