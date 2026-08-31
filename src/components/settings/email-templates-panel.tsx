"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteEmailTemplate,
  saveEmailTemplate,
} from "@/server/actions/email-templates";
import {
  EMAIL_VARIABLES,
  PREVIEW_CONTEXT,
  renderTemplate,
} from "@/lib/email-variables";

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

/**
 * Modèles d'e-mail. Le corps du message vivait dans le JSON d'une règle
 * d'automatisation : ni réutilisable, ni prévisualisable, et il fallait taper
 * les variables de mémoire. Ils deviennent des objets à part entière.
 */
export function EmailTemplatesPanel({
  templates,
  emailConfigured,
}: {
  templates: EmailTemplate[];
  emailConfigured: boolean;
}) {
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const draft = editing ?? (creating ? { id: "", name: "", subject: "", body: "" } : null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          Modèles d&apos;e-mail
        </CardTitle>
        {!draft ? (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            Nouveau modèle
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {!emailConfigured ? (
          <p className="rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
            Tu peux écrire tes modèles dès maintenant, mais aucun envoi ne partira
            tant que <code className="font-mono">RESEND_API_KEY</code> n&apos;est pas
            renseignée dans les variables d&apos;environnement.
          </p>
        ) : null}

        {draft ? (
          <TemplateEditor
            template={draft}
            onDone={() => {
              setEditing(null);
              setCreating(false);
            }}
          />
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun modèle. Crées-en un pour l&apos;envoyer depuis une fiche ou
            l&apos;utiliser dans une automatisation.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                onEdit={() => setEditing(template)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TemplateRow({
  template,
  onEdit,
}: {
  template: EmailTemplate;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    startTransition(async () => {
      const result = await deleteEmailTemplate(template.id);
      if (result.ok) {
        toast.success(`Modèle « ${template.name} » supprimé`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{template.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {template.subject || "Sans objet"}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onEdit}
        aria-label={`Modifier ${template.name}`}
      >
        <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={remove}
        disabled={pending}
        aria-label={`Supprimer ${template.name}`}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
        )}
      </Button>
    </li>
  );
}

function TemplateEditor({
  template,
  onDone,
}: {
  template: EmailTemplate;
  onDone: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [preview, setPreview] = useState(false);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  /** Insère la variable là où est le curseur, pas au bout du texte. */
  function insert(token: string) {
    const field = bodyRef.current;
    if (!field) {
      setBody((current) => current + token);
      return;
    }

    const start = field.selectionStart;
    const end = field.selectionEnd;
    setBody((current) => current.slice(0, start) + token + current.slice(end));

    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveEmailTemplate({
        id: template.id || undefined,
        name,
        subject,
        body,
      });
      if (result.ok) {
        toast.success(template.id ? "Modèle enregistré" : "Modèle créé");
        onDone();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-surface p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-name">Nom du modèle</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Première relance"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-subject">Objet</Label>
          <Input
            id="tpl-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Suite à notre échange, {{company.name}}"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="tpl-body">Message</Label>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setPreview((v) => !v)}
            aria-pressed={preview}
          >
            <Eye className="size-3" strokeWidth={1.75} aria-hidden />
            {preview ? "Modifier" : "Aperçu"}
          </Button>
        </div>

        {preview ? (
          <div className="rounded-md border bg-card p-4">
            <p className="mb-3 border-b pb-2 text-sm font-medium">
              {renderTemplate(subject, PREVIEW_CONTEXT) || "Sans objet"}
            </p>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {renderTemplate(body, PREVIEW_CONTEXT) || "Message vide."}
            </p>
            <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
              Aperçu avec des données d&apos;exemple.
            </p>
          </div>
        ) : (
          <Textarea
            ref={bodyRef}
            id="tpl-body"
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Bonjour,\n\nJe reviens vers vous concernant…"}
          />
        )}
      </div>

      {!preview ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            Insérer une variable — elle sera remplacée à l&apos;envoi
          </span>
          <div className="flex flex-wrap gap-1">
            {EMAIL_VARIABLES.map((variable) => (
              <button
                key={variable.token}
                type="button"
                onClick={() => insert(variable.token)}
                title={variable.token}
                className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
              >
                {variable.label}
              </button>
            ))}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Une variable peut avoir une <strong className="font-medium">valeur de
            secours</strong>, après une barre verticale : elle sert quand
            l&apos;information manque.
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Bonjour {"{{contact.first_name|l'équipe}}"},
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            donne « Bonjour Marc, » si le prénom est connu, « Bonjour
            l&apos;équipe, » sinon. Un seul modèle suffit donc pour tout le
            monde.
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Enregistrer
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
