"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { guessMapping, parseCsv, type ParsedCsv } from "@/lib/csv";
import { importCompanies, IMPORT_FIELDS, type ImportReport } from "@/server/actions/import";

const IGNORE = "__ignore__";
const MAX_ROWS = 5000;

export function CsvImport({ stages }: { stages: { id: string; name: string }[] }) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [createDeals, setCreateDeals] = useState(false);
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(file: File) {
    setReport(null);

    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      toast.error("Ce fichier n'est pas un CSV. Exporte ton tableur au format CSV.");
      return;
    }

    const text = await file.text();
    const result = parseCsv(text);

    if (result.rows.length === 0) {
      toast.error("Le fichier ne contient aucune ligne exploitable.");
      return;
    }
    if (result.rows.length > MAX_ROWS) {
      toast.error(`Le fichier dépasse ${MAX_ROWS} lignes. Découpe-le en plusieurs imports.`);
      return;
    }

    setParsed(result);
    setMapping(guessMapping(result.headers));
    toast.success(
      `${result.rows.length} ligne${result.rows.length > 1 ? "s" : ""} lue${result.rows.length > 1 ? "s" : ""}`,
      { description: "Vérifie la correspondance des colonnes avant d'importer." },
    );
  }

  function runImport() {
    if (!parsed) return;

    const cleaned = Object.fromEntries(
      Object.entries(mapping).filter(([, field]) => field && field !== IGNORE),
    );

    if (!Object.values(cleaned).includes("name")) {
      toast.error("Indique quelle colonne contient le nom de l'entreprise.");
      return;
    }

    startTransition(async () => {
      const result = await importCompanies({
        rows: parsed.rows,
        mapping: cleaned,
        createDealsInStage: createDeals ? stageId : undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setReport(result.data);
      toast.success(
        `${result.data.created} entreprise${result.data.created > 1 ? "s" : ""} importée${result.data.created > 1 ? "s" : ""}`,
      );
      router.refresh();
    });
  }

  const mappedFields = new Set(Object.values(mapping).filter((f) => f && f !== IGNORE));

  return (
    <div className="flex flex-col gap-5">
      {/* Étape 1 — le fichier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">1. Choisis ton fichier</CardTitle>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="csv-file"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void onFile(file);
            }}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors duration-150 hover:border-primary hover:bg-brand-soft"
          >
            <FileUp className="size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
            <span className="text-sm font-medium">
              Dépose ton CSV ici, ou clique pour le choisir
            </span>
            <span className="text-xs text-muted-foreground">
              Séparateur virgule ou point-virgule, jusqu&apos;à {MAX_ROWS} lignes.
            </span>
            <input
              ref={inputRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {/* Étape 2 — la correspondance des colonnes */}
      {parsed ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              2. Vérifie la correspondance des colonnes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colonne du fichier</TableHead>
                    <TableHead>Exemple</TableHead>
                    <TableHead className="w-56">Champ Kairos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.headers.map((header) => (
                    <TableRow key={header}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell className="max-w-40 truncate text-muted-foreground">
                        {parsed.rows[0]?.[header] || "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[header] ?? IGNORE}
                          onValueChange={(v) =>
                            setMapping((current) => ({ ...current, [header]: String(v) }))
                          }
                        >
                          <SelectTrigger aria-label={`Champ pour ${header}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORE}>Ne pas importer</SelectItem>
                            {IMPORT_FIELDS.map((field) => (
                              <SelectItem
                                key={field.key}
                                value={field.key}
                                disabled={
                                  mappedFields.has(field.key) && mapping[header] !== field.key
                                }
                              >
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!mappedFields.has("name") ? (
              <p className="flex items-start gap-2 text-sm text-warning">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                Indique quelle colonne contient le nom de l&apos;entreprise : c&apos;est le
                seul champ obligatoire.
              </p>
            ) : null}

            {stages.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-lg border bg-surface p-3">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="create-deals"
                    checked={createDeals}
                    onCheckedChange={(v) => setCreateDeals(v === true)}
                  />
                  <div>
                    <Label htmlFor="create-deals" className="font-normal">
                      Créer aussi une opportunité par entreprise
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pratique pour retrouver tout ton tableur directement dans le pipeline.
                    </p>
                  </div>
                </div>

                {createDeals ? (
                  <Select value={stageId} onValueChange={(v) => setStageId(String(v))}>
                    <SelectTrigger className="sm:w-64" aria-label="Étape de départ">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {parsed.rows.length} ligne{parsed.rows.length > 1 ? "s" : ""} prête
                {parsed.rows.length > 1 ? "s" : ""} à importer
              </span>
              <Button onClick={runImport} disabled={pending || !mappedFields.has("name")}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-4" strokeWidth={1.75} aria-hidden />
                )}
                Importer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Étape 3 — le compte rendu */}
      {report ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">3. Résultat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-success" strokeWidth={1.75} aria-hidden />
              <span className="tabular font-medium">{report.created}</span> entreprise
              {report.created > 1 ? "s" : ""} créée{report.created > 1 ? "s" : ""}.
            </p>

            {report.skipped > 0 ? (
              <div className="text-sm">
                <p className="text-muted-foreground">
                  <span className="tabular font-medium text-foreground">{report.skipped}</span>{" "}
                  doublon{report.skipped > 1 ? "s" : ""} ignoré{report.skipped > 1 ? "s" : ""}{" "}
                  (déjà dans ton espace, rien n&apos;a été écrasé).
                </p>
                {report.duplicates.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {report.duplicates.join(", ")}
                    {report.skipped > report.duplicates.length ? "…" : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            {report.errors.length > 0 ? (
              <div className="text-sm">
                <p className="text-warning">
                  {report.errors.length} ligne{report.errors.length > 1 ? "s" : ""} non
                  importée{report.errors.length > 1 ? "s" : ""} :
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {report.errors.slice(0, 10).map((e) => (
                    <li key={e.line}>
                      Ligne {e.line} — {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Button
              variant="outline"
              className="w-fit"
              onClick={() => {
                setParsed(null);
                setReport(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Importer un autre fichier
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
