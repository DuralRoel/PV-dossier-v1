/**
 * Minimal CSV parser (supports quotes and commas inside quotes).
 * Assumes first row = headers. Returns array of objects.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  const pushCell = () => { cur.push(cell); cell = ""; };
  const pushRow = () => {
    if (cur.length === 1 && cur[0].trim() === "") { cur = []; return; }
    rows.push(cur);
    cur = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && ch === ",") { pushCell(); i++; continue; }
    if (!inQuotes && ch === "\n") { pushCell(); pushRow(); i++; continue; }
    if (!inQuotes && ch === "\r") { i++; continue; }

    cell += ch;
    i++;
  }

  pushCell();
  pushRow();

  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (rows[r][c] ?? "").trim();
    if (Object.values(obj).every(v => v === "")) continue;
    out.push(obj);
  }
  return out;
}
