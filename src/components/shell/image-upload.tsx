"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

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
  disabled,
}: {
  workspaceId: string;
  /** Sous-dossier : logo, avatars, contacts… */
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void | Promise<void>;
  label: string;
  shape?: "square" | "circle";
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Réduit au plus long côté demandé, en conservant les proportions. */
  async function shrink(file: File, max = 512): Promise<Blob> {
    // Un SVG est déjà vectoriel : le passer par un canvas le dégraderait.
    if (file.type === "image/svg+xml") return file;

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
    if (file.size > MAX_BYTES * 4) {
      toast.error("Fichier trop lourd", {
        description: "Au-delà de 8 Mo, réduis l'image avant de l'envoyer.",
      });
      return;
    }

    setBusy(true);
    try {
      const blob = await shrink(file);
      const extension = file.type === "image/svg+xml" ? "svg" : "webp";
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
          PNG, JPEG, WebP ou SVG. Redimensionnée automatiquement.
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
