"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Ce qu'on accepte en entrée. Ce qui est stocké est toujours plus léger :
 *  tout est recompressé dans le navigateur, sauf les formats vectoriels. */
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const ACCEPTED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

/** Formats laissés intacts : les passer par un canvas les dégraderait. */
const PASSTHROUGH = ["image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];

/**
 * Envoi d'image vers Supabase Storage, cloisonné par espace.
 *
 * Le fichier est redimensionné et recompressé dans le navigateur avant de
 * partir : une photo de téléphone fait 5 Mo, la même à 512 px en fait 60 Ko,
 * et personne n'a envie d'attendre — ni de payer le stockage.
 */
export function ImageUpload({
  workspaceId,
  folder,
  value,
  onChange,
  label,
  shape = "square",
  size = 512,
  hint,
  disabled,
}: {
  workspaceId: string;
  /** Sous-dossier : logo, favicon, avatars, contacts… */
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void | Promise<void>;
  label: string;
  shape?: "square" | "circle";
  /** Côté le plus long après redimensionnement. */
  size?: number;
  hint?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Réduit au plus long côté demandé, en conservant les proportions. */
  async function shrink(file: File, max: number): Promise<Blob> {
    if (PASSTHROUGH.includes(file.type)) return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? file), "image/webp", 0.86);
    });
  }

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non accepté", {
        description: "Utilise un PNG, JPEG, WebP ou SVG.",
      });
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error("Fichier trop lourd", {
        description: `Maximum 8 Mo. Le tien fait ${(file.size / 1024 / 1024).toFixed(1)} Mo.`,
      });
      return;
    }

    setBusy(true);
    try {
      const blob = await shrink(file, size);
      const extension = PASSTHROUGH.includes(file.type)
        ? (file.name.split(".").pop() ?? "png").toLowerCase()
        : "webp";
      // Nom unique : remplacer un fichier au même chemin laisserait l'ancienne
      // image en cache chez tous ceux qui l'avaient déjà vue.
      const path = `${workspaceId}/${folder}/${crypto.randomUUID()}.${extension}`;

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("workspace-files")
        .upload(path, blob, { contentType: blob.type || file.type, upsert: false });

      if (error) {
        console.error("[upload] envoi impossible", error.message);
        toast.error("Envoi impossible", {
          description: "Réessaie ; si ça persiste, vérifie ta connexion.",
        });
        return;
      }

      const { data } = await supabase.storage
        .from("workspace-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (!data?.signedUrl) {
        toast.error("Image envoyée, mais son adresse n'a pas pu être créée.");
        return;
      }

      await onChange(data.signedUrl);
      toast.success("Image enregistrée");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "grid size-16 shrink-0 place-items-center overflow-hidden border bg-surface",
          shape === "circle" ? "rounded-full" : "rounded-lg",
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={label}
            className="size-full object-cover"
            onError={() => onChange(null)}
          />
        ) : (
          <ImageUp className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Remplacer" : "Choisir une image"}
          </Button>

          {value ? (
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={disabled || busy}
              onClick={() => onChange(null)}
              aria-label={`Retirer ${label}`}
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
            </Button>
          ) : null}
        </div>

        <span className="text-xs text-muted-foreground">
          {hint ?? "PNG, JPEG, WebP, SVG ou ICO. Redimensionnée automatiquement."}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
