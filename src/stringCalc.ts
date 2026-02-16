import type { InverterInput, PanelInput } from "./types";

export type StringResult = {
  nMin: number;
  nMax: number;
  nSeries: number | null;     // gekozen aantal panelen in serie
  strings: number[];          // per string aantal panelen
  totalPanels: number;
  vocString: number | null;   // Voc van standaard string
  ok: boolean;
  message: string;
};

export function calcStrings(totalPanels: number, panel: PanelInput, inv: InverterInput): StringResult {
  const vocP = Number(panel.voc || 0);
  const vMin = Number(inv.vocMin || 0);
  const vMax = Number(inv.vocMax || 0);

  if (!totalPanels || totalPanels <= 0) {
    return {
      nMin: 0, nMax: 0, nSeries: null, strings: [], totalPanels,
      vocString: null, ok: false, message: "Geen panelen geselecteerd."
    };
  }
  if (!vocP || vocP <= 0 || !vMin || !vMax || vMax <= 0) {
    return {
      nMin: 0, nMax: 0, nSeries: null, strings: [totalPanels], totalPanels,
      vocString: null, ok: false,
      message: "Vul Voc paneel + omvormer Voc-min/Voc-max in om strings te berekenen."
    };
  }
  const nMin = Math.ceil(vMin / vocP);
  const nMax = Math.floor(vMax / vocP);

  if (nMin > nMax) {
    return {
      nMin, nMax, nSeries: null, strings: [totalPanels], totalPanels,
      vocString: null, ok: false,
      message: `Onmogelijk: nMin (${nMin}) > nMax (${nMax}). Check Voc-instellingen.`
    };
  }

  // kies standaard nSeries = min(nMax, totalPanels) zodat je weinig strings hebt
  const nSeries = Math.min(nMax, totalPanels);
  const stringsCount = Math.ceil(totalPanels / nSeries);
  const strings: number[] = [];
  let remain = totalPanels;
  for (let i = 0; i < stringsCount; i++) {
    const take = Math.min(nSeries, remain);
    strings.push(take);
    remain -= take;
  }

  // check: elke string moet >= nMin
  const bad = strings.some(s => s < nMin);
  const ok = !bad;

  return {
    nMin, nMax, nSeries, strings, totalPanels,
    vocString: nSeries * vocP,
    ok,
    message: ok
      ? `OK: ${strings.length} string(s). Standaard ${nSeries} panelen/string.`
      : `Let op: minstens één string is korter dan nMin (${nMin}). Pas aantal panelen of omvormer-instellingen aan.`
  };
}
