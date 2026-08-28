"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, Moon, Repeat, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { installRecipe } from "@/server/actions/automations";

const RECIPES = [
  {
    key: "follow_up" as const,
    name: "Relance systématique après contact",
    description:
      "Un prospect passe en « Contacté » → une relance est créée à J+5 et posée dans ton agenda.",
    icon: CalendarClock,
    highlight: true,
  },
  {
    key: "second_chance" as const,
    name: "Deuxième relance sans réponse",
    description:
      "Une relance terminée sans suite → une deuxième est programmée à J+7.",
    icon: Repeat,
  },
  {
    key: "stale_deal" as const,
    name: "Opportunité qui dort",
    description:
      "Aucune activité depuis 14 jours → une note est ajoutée et une relance créée pour demain.",
    icon: Moon,
  },
  {
    key: "won_thanks" as const,
    name: "Nouveau client : remerciement",
    description:
      "Une opportunité passe en gagnée → e-mail de remerciement et webhook sortant.",
    icon: Trophy,
  },
];

export function RecipeGallery({ installed }: { installed: Set<string> }) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function install(key: (typeof RECIPES)[number]["key"]) {
    setPendingKey(key);
    startTransition(async () => {
      const result = await installRecipe(key);
      setPendingKey(null);

      if (result.ok) {
        toast.success("Automatisation activée");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {RECIPES.map((recipe) => {
        const Icon = recipe.icon;
        const already = installed.has(recipe.name);

        return (
          <Card key={recipe.key}>
            <CardContent className="flex items-start gap-3 py-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft">
                <Icon className="size-4 text-primary" strokeWidth={1.75} aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {recipe.name}
                  {recipe.highlight ? (
                    <span className="ml-2 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-normal text-primary">
                      la plus utile
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>

                <Button
                  variant={already ? "ghost" : "outline"}
                  size="sm"
                  className="mt-3"
                  disabled={already || pendingKey !== null}
                  onClick={() => install(recipe.key)}
                >
                  {pendingKey === recipe.key ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : already ? (
                    <Check className="size-3.5 text-success" strokeWidth={2} aria-hidden />
                  ) : null}
                  {already ? "Déjà active" : "Activer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
