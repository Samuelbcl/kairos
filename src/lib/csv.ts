/**
 * Analyseur CSV minimal mais correct : gère les guillemets, les guillemets
 * échappés (""), les retours à la ligne dans un champ, et détecte le séparateur
 * (virgule ou point-virgule — Excel francophone produit du point-virgule).
 *
 * Pas de dépendance : le format est simple et une lib de plus ne se justifie pas.
 */

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
};

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] ?? "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;

  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char in counts) counts[char] += 1;
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseCsv(text: string): ParsedCsv {
  // Retire le BOM d'Excel, qui polluerait le nom de la première colonne.
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean);
  const raw = splitRows(clean, delimiter).filter((r) => r.some((c) => c.trim()));

  if (raw.length === 0) return { headers: [], rows: [], delimiter };

  const headers = raw[0].map((h, i) => h.trim() || `Colonne ${i + 1}`);
  const rows = raw.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = (cells[i] ?? "").trim();
    });
    return record;
  });

  return { headers, rows, delimiter };
}

/**
 * Devine à quel champ Kairos correspond une colonne, à partir de son intitulé.
 * Couvre les en-têtes français et anglais courants.
 */
const GUESSES: Record<string, RegExp> = {
  name: /^(nom|entreprise|société|societe|raison\s*sociale|company|name|client)$/i,
  email: /^(e-?mail|courriel|mail|adresse\s*mail)$/i,
  phone: /^(t[ée]l|t[ée]l[ée]phone|phone|gsm|mobile|num[ée]ro)$/i,
  website: /^(site|site\s*web|web|url|website)$/i,
  sector: /^(secteur|activit[ée]|domaine|industry|sector)$/i,
  address: /^(adresse|rue|address|street)$/i,
  city: /^(ville|commune|localit[ée]|city)$/i,
  country: /^(pays|country)$/i,
  size: /^(taille|effectif|size|employees)$/i,
  tags: /^(tags?|[ée]tiquettes?|cat[ée]gorie|labels?)$/i,
};

export function guessMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  for (const header of headers) {
    const normalized = header.trim();
    for (const [field, pattern] of Object.entries(GUESSES)) {
      if (used.has(field)) continue;
      if (pattern.test(normalized)) {
        mapping[header] = field;
        used.add(field);
        break;
      }
    }
  }

  return mapping;
}
