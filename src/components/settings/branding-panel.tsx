"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateBranding, updateWorkspace } from "@/server/actions/workspace-settings";
import type { Branding } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/** Palette proposée — l'utilisateur peut aussi saisir n'importe quel hexadécimal. */
const ACCENTS = [
  { value: "#4F46E5", name: "Indigo" },
  { value: "#0F766E", name: "Sarcelle" },
  { value: "#B45309", name: "Ambre" },
  { value: "#BE123C", name: "Framboise" },
  { value: "#1D4ED8", name: "Bleu" },
  { value: "#15803D", name: "Vert" },
  { value: "#7E22CE", name: "Violet" },
  { value: "#334155", name: "Ardoise" },
];

const RADII = [
  { value: "0.25rem", label: "Net" },
  { value: "0.5rem", label: "Léger" },
  { value: "0.75rem", label: "Doux" },
  { value: "1rem", label: "Rond" },
];

const TIMEZONES = [
  "Europe/Brussels",
  "Europe/Paris",
  "Europe/Luxembourg",
  "Europe/Amsterdam",
  "Europe/Zurich",
  "Europe/London",
];

export function BrandingPanel({
  workspaceName,
  timezone,
  branding,
  canManage,
}: {
  workspaceName: string;
  timezone: string;
  branding: Branding;
  canManage: boolean;
}) {
  const [name, setName] = useState(workspaceName);
  const [tz, setTz] = useState(timezone);
  const [brandName, setBrandName] = useState(branding.brand_name ?? "");
  const [accent, setAccent] = useState(branding.accent ?? "#4F46E5");
  const [radius, setRadius] = useState(branding.radius ?? "0.75rem");
  const [logoUrl, setLogoUrl] = useState(branding.logo_url ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Aperçu live : les variables sont posées sur le bloc d'aperçu uniquement.
  const previewStyle = {
    "--primary": accent,
    "--brand-soft": `color-mix(in oklch, ${accent} 12%, var(--background))`,
    "--radius": radius,
  } as React.CSSProperties;

  function save() {
    startTransition(async () => {
      const [brandingResult, workspaceResult] = await Promise.all([
        updateBranding({
          brand_name: brandName,
          accent,
          radius,
          logo_url: logoUrl,
        }),
        updateWorkspace({ name, timezone: tz }),
      ]);

      if (!brandingResult.ok) {
        toast.error(brandingResult.error);
        return;
      }
      if (!workspaceResult.ok) {
        toast.error(workspaceResult.error);
        return;
      }

      toast.success("Apparence enregistrée");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Palette className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Apparence et identité
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">Nom de l&apos;espace</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage || pending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-brand">Nom affiché (marque blanche)</Label>
            <Input
              id="ws-brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={name}
              disabled={!canManage || pending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-tz">Fuseau horaire</Label>
            <Select value={tz} onValueChange={(v) => setTz(String(v))} disabled={!canManage || pending}>
              <SelectTrigger id="ws-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-logo">URL du logo</Label>
            <Input
              id="ws-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              disabled={!canManage || pending}
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm">Couleur d&apos;accent</legend>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAccent(option.value)}
                disabled={!canManage || pending}
                aria-label={option.name}
                aria-pressed={accent === option.value}
                className={cn(
                  "size-7 rounded-full border-2 transition-transform duration-150 hover:scale-110",
                  accent === option.value ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: option.value }}
              />
            ))}
            <Input
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="w-28 font-mono text-xs"
              aria-label="Code couleur personnalisé"
              disabled={!canManage || pending}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm">Arrondi des angles</legend>
          <div className="flex flex-wrap gap-1.5">
            {RADII.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRadius(option.value)}
                disabled={!canManage || pending}
                aria-pressed={radius === option.value}
                className={cn(
                  "border px-3 py-1 text-sm transition-colors duration-150",
                  radius === option.value
                    ? "border-primary bg-brand-soft font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                style={{ borderRadius: option.value }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Aperçu live — exactement les composants de l'app */}
        <div style={previewStyle} className="rounded-lg border bg-surface p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Aperçu</p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="grid size-8 place-items-center text-sm font-semibold text-primary-foreground"
              style={{ background: accent, borderRadius: radius }}
            >
              {(brandName || name).slice(0, 1).toUpperCase()}
            </span>
            <span className="text-sm font-semibold">{brandName || name}</span>
            <span
              className="px-2.5 py-1 text-sm text-primary-foreground"
              style={{ background: accent, borderRadius: radius }}
            >
              Programmer la relance
            </span>
            <span
              className="border px-2.5 py-1 text-sm"
              style={{
                borderRadius: radius,
                background: `color-mix(in oklch, ${accent} 12%, white)`,
              }}
            >
              Aujourd&apos;hui
            </span>
          </div>
        </div>

        {canManage ? (
          <Button className="w-fit" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Enregistrer
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Seuls les propriétaires et administrateurs peuvent modifier ces réglages.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
