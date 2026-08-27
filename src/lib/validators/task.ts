import { z } from "zod";
import { optionalText, priorityEnum, uuid } from "./common";

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  uuid.optional(),
);

/** Accepte un datetime-local ("2026-09-01T14:30") comme un ISO complet. */
const dateTime = z.preprocess(
  (v) => {
    if (typeof v !== "string" || !v.trim()) return undefined;
    const parsed = new Date(v);
    return Number.isNaN(parsed.getTime()) ? v : parsed.toISOString();
  },
  z.iso.datetime("Date d'échéance invalide."),
);

export const taskKindEnum = z.enum(["follow_up", "call", "email", "meeting", "todo"]);

export const taskCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Donne un titre à la relance.").max(200),
    kind: taskKindEnum.default("follow_up"),
    notes: optionalText,
    due_at: dateTime,
    /** Minutes de rappel avant l'échéance. 0 = pas de rappel. */
    remind_before_min: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 30 : Number(v)),
      z.number().int().min(0).max(60 * 24 * 30),
    ),
    priority: priorityEnum.default("normal"),
    company_id: optionalUuid,
    contact_id: optionalUuid,
    deal_id: optionalUuid,
    assignee_id: optionalUuid,
  })
  .refine((v) => v.company_id || v.contact_id || v.deal_id, {
    message: "Rattache la relance à une entreprise, un contact ou une opportunité.",
    path: ["company_id"],
  });

export const taskUpdateSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(200).optional(),
  kind: taskKindEnum.optional(),
  notes: optionalText,
  due_at: dateTime.optional(),
  remind_before_min: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(60 * 24 * 30).optional(),
  ),
  priority: priorityEnum.optional(),
});

export const taskSnoozeSchema = z.object({
  id: uuid,
  days: z.coerce.number().int().min(1).max(365),
});

export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
