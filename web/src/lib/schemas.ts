import { z } from "zod";

export const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
});

export const fieldTypeSchema = z.enum(["text", "number", "check"]);

export const createFieldSchema = z.object({
  pageNo: z.number().int().min(1).default(1),
  label: z.string().min(1),
  dataKey: z.string().min(1).optional(),
  type: fieldTypeSchema,
  box: boxSchema,
  required: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const updateFieldSchema = z.object({
  label: z.string().min(1).optional(),
  dataKey: z.string().min(1).optional(),
  type: fieldTypeSchema.optional(),
  box: boxSchema.optional(),
  required: z.boolean().optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  status: z.enum(["suggested", "confirmed"]).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const createTemplateSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1),
  pageCount: z.number().int().min(1).default(1),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "retired"]).optional(),
});
