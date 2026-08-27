import "server-only";

import { Resend } from "resend";

/**
 * Envoi d'e-mails transactionnels via Resend.
 * Ne jette jamais : un envoi raté ne doit pas annuler l'action métier qui
 * l'a déclenché. L'appelant décide quoi afficher à partir du retour.
 */

export type SendResult = { sent: boolean; id?: string; error?: string };

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function client() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function sender() {
  return process.env.RESEND_FROM ?? "Kairos <onboarding@resend.dev>";
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const resend = client();
  if (!resend) {
    return {
      sent: false,
      error:
        "Envoi impossible : RESEND_API_KEY n'est pas configurée. Ajoute-la dans Réglages ou dans .env.local.",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: sender(),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html ?? simpleHtml(input.subject, input.text),
      replyTo: input.replyTo,
    });

    if (error) {
      console.error("[email] Resend a refusé l'envoi", error.message);
      return { sent: false, error: `Resend a refusé l'envoi : ${error.message}` };
    }

    return { sent: true, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erreur inconnue";
    console.error("[email] envoi impossible", message);
    return { sent: false, error: `Envoi impossible : ${message}` };
  }
}

/** Gabarit HTML minimal : lisible partout, sans image ni script. */
function simpleHtml(subject: string, text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;line-height:1.6">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e7ea;border-radius:12px;padding:28px">
<h1 style="margin:0 0 20px;font-size:17px;font-weight:600">${escapeHtml(subject)}</h1>
${paragraphs}
</div></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Interpole {{variable}} depuis un contexte plat. Variable inconnue → vide. */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = path
      .split(".")
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === "object"
            ? (acc as Record<string, unknown>)[key]
            : undefined,
        context,
      );
    return value == null ? "" : String(value);
  });
}
