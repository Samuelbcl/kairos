import Link from "next/link";
import { CalendarClock, Check, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = {
  done: boolean;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof Upload;
};

/**
 * Premiers pas dans un espace neuf.
 *
 * Un tableau de bord vide ne dit pas quoi faire, et c'est le moment exact où un
 * nouveau client décide s'il continue. Les trois étapes suivent le parcours du
 * produit : entrer ses données, brancher son agenda, laisser Kairos relancer.
 */
export function Onboarding({
  hasCompanies,
  hasCalendar,
  hasAutomation,
}: {
  hasCompanies: boolean;
  hasCalendar: boolean;
  hasAutomation: boolean;
}) {
  const steps: Step[] = [
    {
      done: hasCompanies,
      title: "Importe tes prospects",
      description:
        "Reprends ton tableur Excel ou CSV. Les colonnes sont reconnues automatiquement et les doublons écartés.",
      href: "/contacts/import",
      cta: "Importer un fichier",
      icon: Upload,
    },
    {
      done: hasCalendar,
      title: "Connecte ton agenda",
      description:
        "Chaque relance devient un événement avec rappel. La terminer retire l'événement.",
      href: "/settings/integrations",
      cta: "Connecter Google Agenda",
      icon: CalendarClock,
    },
    {
      done: hasAutomation,
      title: "Active la relance automatique",
      description:
        "Un prospect passe en « Contacté » et la relance à J+5 se crée toute seule, agenda compris.",
      href: "/automations",
      cta: "Activer la recette",
      icon: Zap,
    },
  ];

  const remaining = steps.filter((step) => !step.done).length;
  if (remaining === 0) return null;

  return (
    <section
      aria-label="Premiers pas"
      className="rounded-lg border bg-card p-5"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Pour démarrer</h2>
        <span className="tabular text-xs text-muted-foreground">
          {steps.length - remaining} sur {steps.length}
        </span>
      </div>

      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-4 transition-colors duration-150",
                step.done ? "border-dashed opacity-60" : "bg-surface",
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  step.done ? "bg-muted" : "bg-brand-soft",
                )}
              >
                {step.done ? (
                  <Check className="size-4 text-success" strokeWidth={2} aria-hidden />
                ) : (
                  <Icon className="size-4 text-primary" strokeWidth={1.75} aria-hidden />
                )}
              </span>

              <div className="flex-1">
                <p className="text-sm font-medium">
                  <span className="tabular mr-1.5 text-muted-foreground">
                    {index + 1}.
                  </span>
                  {step.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>

              {step.done ? (
                <span className="text-xs text-muted-foreground">C&apos;est fait.</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  nativeButton={false}
                  render={<Link href={step.href} />}
                >
                  {step.cta}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
