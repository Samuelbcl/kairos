import { z } from "zod";
import {
  customSchema,
  optionalEmail,
  optionalPhone,
  optionalText,
  optionalUrl,
  tagsSchema,
  uuid,
} from "./common";

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'entreprise est obligatoire.").max(200),
  email: optionalEmail,
  phone: optionalPhone,
  website: optionalUrl,
  sector: optionalText,
  address: optionalText,
  city: optionalText,
  country: emptyDefault("BE"),
  size: optionalText,
  source: optionalText,
  tags: tagsSchema.optional(),
  custom: customSchema.optional(),
});

export const companyUpdateSchema = companyCreateSchema.partial().extend({
  id: uuid,
});

function emptyDefault(fallback: string) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? fallback : v),
    z.string().trim().max(10),
  );
}

export type CompanyCreate = z.infer<typeof companyCreateSchema>;
export type CompanyUpdate = z.infer<typeof companyUpdateSchema>;
