import { z } from "zod";
import { optionalText, priorityEnum, uuid } from "./common";

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  uuid.optional(),
);

const money = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
  z.number().min(0, "Le montant ne peut pas être négatif.").max(1e12),
);

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.iso.date("Date invalide.").optional(),
);

export const dealCreateSchema = z.object({
  title: z.string().trim().min(1, "Donne un titre à l'opportunité.").max(200),
  stage_id: uuid,
  company_id: optionalUuid,
  contact_id: optionalUuid,
  value: money.optional(),
  priority: priorityEnum.optional(),
  expected_close: optionalDate,
});

export const dealUpdateSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(200).optional(),
  stage_id: optionalUuid,
  company_id: z.preprocess((v) => (v === "" ? null : v), uuid.nullable().optional()),
  contact_id: z.preprocess((v) => (v === "" ? null : v), uuid.nullable().optional()),
  value: money.optional(),
  priority: priorityEnum.optional(),
  expected_close: optionalDate,
  notes: optionalText,
});

export const dealMoveSchema = z.object({
  id: uuid,
  stage_id: uuid,
});

export type DealCreate = z.infer<typeof dealCreateSchema>;
export type DealUpdate = z.infer<typeof dealUpdateSchema>;
