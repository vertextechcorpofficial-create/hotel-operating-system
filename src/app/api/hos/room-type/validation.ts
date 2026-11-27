import { z } from "zod";

/**
 * Server-side schema for room type payloads. Mirrors the form schema in
 * room-type/components/type-form.tsx; unknown keys are stripped so raw request
 * bodies are never spread into Directus.
 */
export const roomTypeSchema = z.object({
    name: z.string().trim().min(1).max(255),
    price: z.number().min(0),
    max_adults: z.number().int().min(1).max(50),
    max_children: z.number().int().min(0).max(50),
    bed: z.string().trim().min(1).max(255),
    description: z.string().max(5000).optional().nullable(),
    original_price: z.number().min(0).optional().nullable(),
    sqm: z.string().max(50).optional().nullable(),
    badge: z.string().max(100).optional().nullable(),
});

export const roomTypeUpdateSchema = roomTypeSchema.partial();
