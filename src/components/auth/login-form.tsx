"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";

const ERRORS: Record<string, string> = {
  callback:
    "La connexion n'a pas abouti. Réessaie ; si ça persiste, vérifie que les cookies sont autorisés.",
  expired: "Ce lien de connexion a expiré. Demande-en un nouveau.",
};

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>(
    initialError ? (ERRORS[initialError] ?? ERRORS.callback) : undefined,
  );

  const callbackUrl = `${env.appUrl}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setError(undefined);
    setPending("google");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setPending(null);
      setError(
        "Connexion Google indisponible. Vérifie que le fournisseur Google est activé dans Supabase → Authentication → Providers.",
      );
    }
  }

  async function signInWithEmail(formData: FormData) {
    const address = String(formData.get("email") ?? "").trim();
    if (!address) return;

    setError(undefined);
    setPending("email");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: callbackUrl },
    });
    setPending(null);

    if (error) {
      setError(
        `Envoi impossible : ${error.message}. Vérifie l'adresse, puis réessaie.`,
      );
      return;
    }

    setSent(true);
    toast.success("Lien envoyé", {
      description: `Ouvre le message reçu sur ${address} pour te connecter.`,
    });
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-9 text-center">
          <CheckCircle2 className="size-6 text-success" strokeWidth={1.5} aria-hidden />
          <div>
            <p className="text-sm font-medium">Lien de connexion envoyé</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ouvre le message reçu sur <strong className="font-medium">{email}</strong>.
              Le lien est valable une heure.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
            Utiliser une autre adresse
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-6">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={signInWithGoogle}
          disabled={pending !== null}
        >
          {pending === "google" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <GoogleIcon />
          )}
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">ou</span>
          <Separator className="flex-1" />
        </div>

        <form action={signInWithEmail} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="prenom@entreprise.be"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending !== null}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending !== null}>
            {pending === "email" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Recevoir un lien de connexion
          </Button>
        </form>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.56Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.7-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.74H1.71v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.18a6.9 6.9 0 0 1 0-4.36V6.84H1.71a11.5 11.5 0 0 0 0 10.32l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.7 1.28 15.1.25 12 .25A11.5 11.5 0 0 0 1.71 6.84l3.84 2.98C6.46 7.1 9 4.75 12 4.75Z"
      />
    </svg>
  );
}
