// Le paquet n'expose pas de racine, uniquement des sous-chemins.
// `/browser` est la bonne cible : l'analyse se fait côté navigateur.
import readXlsxFile from "read-excel-file/browser";
import { parseCsv, type ParsedCsv } from "./csv";

/**
 * Lit un tableur, quel que soit son format : CSV ou Excel (.xlsx).
 * Renvoie toujours la même forme, pour que l'écran d'import n'ait pas à savoir
 * d'où viennent les lignes.
 *
 * L'analyse se fait dans le navigateur : le fichier ne transite par aucun
 * serveur avant que l'utilisateur ait validé la correspondance des colonnes.
 */

export type ParsedSheet = ParsedCsv & {
  format: "csv" | "xlsx";
  /** Onglet retenu, et les autres, pour les classeurs à plusieurs feuilles. */
  sheetName?: string;
  otherSheets?: string[];
};

export function isSupportedFile(file: File): boolean {
  return /\.(csv|xlsx)$/i.test(file.name);
}

/** `.xls` (ancien format binaire) n'est pas lisible : on le dit clairement. */
export function isLegacyExcel(file: File): boolean {
  return /\.xls$/i.test(file.name);
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    // Format ISO court : lisible, et exploitable par un champ date.
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "boolean") return value ? "oui" : "non";
  return String(value).trim();
}

type SheetLike = { sheet: string; data: unknown[][] };

function isSheetLike(value: unknown): value is SheetLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray((value as SheetLike).data)
  );
}

/**
 * `readXlsxFile` renvoie la liste des feuilles (`[{ sheet, data }]`), pas les
 * lignes. On accepte aussi la forme « lignes directes » par prudence : la
 * bibliothèque expose les deux selon les options.
 */
function toSheets(result: unknown): SheetLike[] {
  if (!Array.isArray(result) || result.length === 0) return [];

  if (isSheetLike(result[0])) {
    return result.filter(isSheetLike);
  }
  return [{ sheet: "", data: result as unknown[][] }];
}

function hasContent(sheet: SheetLike): boolean {
  return sheet.data.some((row) =>
    Array.isArray(row) ? row.some((cell) => cellToString(cell) !== "") : false,
  );
}

async function parseXlsx(file: File): Promise<ParsedSheet> {
  const sheets = toSheets(await readXlsxFile(file));

  // Un classeur réel commence souvent par un onglet de garde vide : on prend
  // la première feuille qui contient réellement quelque chose.
  const chosen = sheets.find(hasContent);

  if (!chosen) {
    return { headers: [], rows: [], delimiter: "", format: "xlsx" };
  }

  const nonEmpty = chosen.data.filter((row) =>
    row.some((cell) => cellToString(cell) !== ""),
  );

  const headers = nonEmpty[0].map(
    (cell, index) => cellToString(cell) || `Colonne ${index + 1}`,
  );

  const rows = nonEmpty.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cellToString(cells[index]);
    });
    return record;
  });

  return {
    headers,
    rows,
    delimiter: "",
    format: "xlsx",
    sheetName: chosen.sheet || undefined,
    otherSheets: sheets
      .filter((sheet) => sheet !== chosen && hasContent(sheet))
      .map((sheet) => sheet.sheet)
      .filter(Boolean),
  };
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  if (/\.xlsx$/i.test(file.name)) {
    return parseXlsx(file);
  }

  const text = await file.text();
  return { ...parseCsv(text), format: "csv" };
}
