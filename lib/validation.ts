import { z } from "zod";

const contactFields = {
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(100),
  whatsapp: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,20}$/),
  email: z.string().trim().email().or(z.literal("")).optional(),
};

export const leadSchema = z.object({
  ...contactFields,
  consent: z.literal(true),
  sourcePath: z.string().max(500).optional(),
});

export const quoteSchema = z.object({
  ...contactFields,
  note: z.string().trim().max(2000).optional(),
  items: z.array(z.object({
    sku: z.string().min(1).max(100),
    variantSku: z.string().min(1).max(100),
    title: z.string().min(1).max(240),
    quantity: z.number().int().positive().max(100000),
    moqUnits: z.number().int().positive().nullable(),
    price: z.number().positive().nullable(),
    image: z.string().max(500).nullable(),
  })).min(1).max(500),
});

export const wholesaleSchema = z.object({
  ...contactFields,
  budget: z.string().trim().min(1).max(100),
  targetMarket: z.string().trim().min(2).max(200),
  categories: z.array(z.string().max(100)).min(1),
  style: z.string().trim().min(2).max(500),
  notes: z.string().trim().max(2000).optional(),
});
