"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS } from "@/lib/tour-steps";
import { saveTourProgress } from "@/server/actions/tour";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 6;
const BUBBLE_WIDTH = 340;
const GAP = 14;

/**
 * Visite guidée : un projecteur sur l'élément dont on parle, une bulle à côté.
 *
 * Écrite à la main plutôt qu'avec une bibliothèque : le contenu est en
 * français, le style suit les couleurs de l'espace, et une dépendance de plus
 * pour trois cents lignes ne se justifiait pas.
 */
export function ProductTour({
  initialStep,
  autoStart,
}: {
  initialStep: number;
  autoStart: boolean;
}) {
  const [open, setOpen] = useState(autoStart);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialStep, 0), TOUR_STEPS.length - 1),
  );
  const [rect, setRect] = useState<Rect | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const bubbleRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[index];

  // Ouverture depuis les réglages, sans remonter d'état jusqu'ici.
  useEffect(() => {
    function onLaunch() {
      setIndex(0);
      setOpen(true);
    }
    window.addEventListener("kairos:tour", onLaunch);
    return () => window.removeEventListener("kairos:tour", onLaunch);
  }, []);

  /** Suit la cible : elle bouge au défilement, au redimensionnement, à la navigation. */
  const locate = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }

    const node = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!node) {
      setRect(null);
      return;
    }

    const box = node.getBoundingClientRect();
    setRect({
      top: box.top - PADDING,
      left: box.left - PADDING,
      width: box.width + PADDING * 2,
      height: box.height + PADDING * 2,
    });
  }, [step]);

  useEffect(() => {
    if (!open) return;

    // La cible peut ne pas être encore montée après une navigation.
    const timer = setTimeout(locate, 60);
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
    };
  }, [open, locate, pathname]);

  // Amène sur la bonne page avant de montrer l'étape.
  useEffect(() => {
    if (!open || !step?.route || pathname === step.route) return;
    router.push(step.route);
  }, [open, step, pathname, router]);

  const finish = useCallback(
    (completed: boolean) => {
      setOpen(false);
      void saveTourProgress(completed ? TOUR_STEPS.length : index, completed);
    },
    [index],
  );

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finish(false);
      if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, finish]);

  useEffect(() => {
    if (open) bubbleRef.current?.focus();
  }, [open, index]);

  if (!open || !step) return null;

  const isFirst = index === 0;
  const isLast = index === TOUR_STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visite guidée de Kairos"
      className="fixed inset-0 z-[60]"
    >
      {/* Voile percé : quatre bandes autour de la cible, plutôt qu'un trou en
          CSS — ça reste net sur tous les navigateurs et ça laisse la cible
          parfaitement lisible. */}
      {rect ? (
        <>
          <Veil style={{ top: 0, left: 0, right: 0, height: Math.max(rect.top, 0) }} />
          <Veil style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
          <Veil
            style={{ top: rect.top, left: 0, width: Math.max(rect.left, 0), height: rect.height }}
          />
          <Veil
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        </>
      ) : (
        <Veil style={{ inset: 0 }} />
      )}

      <div
        ref={bubbleRef}
        tabIndex={-1}
        style={bubblePosition(rect, step.side)}
        className="absolute w-[min(21rem,calc(100vw-2rem))] rounded-lg border bg-card p-4 shadow-lg outline-none"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="tabular text-xs text-muted-foreground">
            {index + 1} / {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => finish(false)}
            aria-label="Fermer la visite"
            className="-mt-1 -mr-1 grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <h2 className="text-sm font-semibold">{step.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>

        {step.action ? (
          <p className="mt-2.5 rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-foreground">
            {step.action}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          <div className="flex gap-1" aria-hidden>
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-150",
                  i === index ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>

          <div className="ml-auto flex gap-1.5">
            {!isFirst ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIndex((i) => i - 1)}
                aria-label="Étape précédente"
              >
                <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
                Retour
              </Button>
            ) : null}

            {isLast ? (
              <Button size="sm" onClick={() => finish(true)}>
                Terminer
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                Suivant
                <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
              </Button>
            )}
          </div>
        </div>

        {!isLast ? (
          <button
            type="button"
            onClick={() => finish(true)}
            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Passer la visite
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Veil({ style }: { style: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className="absolute bg-foreground/45 transition-all duration-200"
      style={style}
    />
  );
}

/** Place la bulle près de la cible, sans jamais sortir de l'écran. */
function bubblePosition(
  rect: Rect | null,
  side: "top" | "bottom" | "left" | "right" = "bottom",
): React.CSSProperties {
  if (typeof window === "undefined" || !rect) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  const { innerWidth: vw, innerHeight: vh } = window;
  const height = 210;
  const width = Math.min(BUBBLE_WIDTH, vw - 32);

  let top: number;
  let left: number;

  switch (side) {
    case "right":
      top = rect.top;
      left = rect.left + rect.width + GAP;
      break;
    case "left":
      top = rect.top;
      left = rect.left - width - GAP;
      break;
    case "top":
      top = rect.top - height - GAP;
      left = rect.left;
      break;
    default:
      top = rect.top + rect.height + GAP;
      left = rect.left;
  }

  // Bascule de l'autre côté plutôt que de déborder.
  if (left + width > vw - 16) left = rect.left - width - GAP;
  if (left < 16) left = Math.min(rect.left + rect.width + GAP, vw - width - 16);
  if (left < 16) left = 16;

  if (top + height > vh - 16) top = Math.max(rect.top - height - GAP, 16);
  if (top < 16) top = 16;

  return { top, left, width };
}
