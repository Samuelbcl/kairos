"use client";

import { ErrorState } from "@/components/shell/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} what="le tableau de bord" />;
}
