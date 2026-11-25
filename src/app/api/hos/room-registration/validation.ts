import { z } from "zod";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const DATA_URL_REGEX = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

/**
 * Server-side schema for room payloads. Mirrors the form schema in
 * room-registration/components/room-form.tsx; unknown keys are stripped so raw
 * request bodies are never spread into Directus.
 */
export const roomSchema = z.object({
    room_number: z.string().trim().min(1).max(20).regex(/^[a-zA-Z0-9]+$/),
    floor_number: z.number().int().min(1).max(200),
    type_id: z.number().int().min(1),
    operational_status_id: z.number().int().min(1),
    housekeeping_status_id: z.number().int().min(1),
    main_image_url: z.string().max(8_000_000).optional().nullable(),
});

export const roomUpdateSchema = roomSchema.partial();

/**
 * Returns an error message when a base64 data URL is not an allowed image
 * type or exceeds the size limit. Non data-URL values (existing file IDs or
 * empty strings) are passed through untouched.
 */
export function validateImagePayload(value?: string | null): string | null {
    if (!value || !value.startsWith("data:")) return null;

    const match = value.match(DATA_URL_REGEX);
    if (!match) {
        return "Only JPEG, PNG, WEBP, or GIF images are allowed.";
    }

    const approxBytes = Math.floor((match[2].length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
        return "Image must be 5MB or smaller.";
    }
    return null;
}
