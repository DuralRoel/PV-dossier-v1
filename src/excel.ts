import * as XLSX from "xlsx";

/**
 * Lees een .xlsx bestand in de browser en geef een Workbook terug.
 */
export async function readXlsxFile(file: File): Promise<XLSX.WorkBook> {
  const data = await file.arrayBuffer();
  return XLSX.read(data, { type: "array" });
}

/**
 * Zet een sheet om naar rijen (JSON objects).
 * Let op: de keys komen van de kolomkoppen in de eerste rij.
 */
export function sheetToRows(wb: XLSX.WorkBook, sheetName: string): Record<string, any>[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];
}
