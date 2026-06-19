export type CsvValue = string | number | null | undefined;

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function preventFormulaInjection(value: string): string {
  const trimmedStart = value.trimStart();
  if (FORMULA_PREFIXES.some((prefix) => trimmedStart.startsWith(prefix))) {
    return `'${value}`;
  }
  return value;
}

function escapeCsvCell(value: CsvValue): string {
  const text = preventFormulaInjection(value == null ? "" : String(value));
  return `"${text.replaceAll('"', '""').replace(/\r?\n/g, "\r\n")}"`;
}

export function createCsv(
  headers: string[],
  rows: CsvValue[][]
): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(","))
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
