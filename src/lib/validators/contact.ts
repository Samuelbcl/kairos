import { z } from "zod";
import {
  customSchema,
  optionalEmail,
  optionalPhone,
  optionalText,
  tagsSchema,
  uuid,
} from "./common";

export const contactCreateSchema = z
  .object({
    company_id: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      uuid.optional(),
    ),
    first_name: optionalText,
    last_name: optionalText,
    email: optionalEmail,
    phone: optionalPhone,
    role_title: optionalText,
    tags: tagsSchema.optional(),
    custom: customSchema.optional(),
  })
  .refine((v) => v.first_name || v.last_name || v.email, {
    message: "Donne au moins un nom ou une adresse e-mail.",
    path: ["first_name"],
  });

export const contactUpdateSchema = z.object({
  id: uuid,
  company_id: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    uuid.nullable().optional(),
  ),
  first_name: optionalText,
  last_name: optionalText,
  email: optionalEmail,
  phone: optionalPhone,
  role_title: optionalText,
  tags: tagsSchema.optional(),
  custom: customSchema.optional(),
});

export type ContactCreate = z.infer<typeof contactCreateSchema>;
export type ContactUpdate = z.infer<typeof contactUpdateSchema>;
