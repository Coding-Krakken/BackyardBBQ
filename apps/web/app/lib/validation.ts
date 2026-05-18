import { z } from "zod";

const phoneRegex = /^\+?[0-9\s().-]{7,20}$/;

export const reservationSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name."),
  email: z.string().trim().email("Please enter a valid email address."),
  phone: z.string().trim().regex(phoneRegex, "Please enter a valid phone number."),
  date: z.string().min(1, "Please select a date."),
  time: z.string().min(1, "Please select a time."),
  partySize: z.number().int().min(1, "Party size must be at least 1.").max(20, "For parties over 20, please use catering."),
  occasion: z.string().trim().max(80).optional().or(z.literal("")),
  specialRequests: z.string().trim().max(500).optional().or(z.literal(""))
});

export type ReservationFormData = z.infer<typeof reservationSchema>;

export function normalizeReservationForm(payload: Record<string, unknown>): ReservationFormData {
  return reservationSchema.parse({
    ...payload,
    partySize: typeof payload.partySize === "string" ? Number(payload.partySize) : payload.partySize
  });
}
