import { z } from "zod";

export const locationTypeSchema = z.enum(["truck", "brick-and-mortar"]);

export const orderSourceSchema = z.enum([
  "direct",
  "doordash",
  "ubereats",
  "grubhub",
  "catering"
]);

export type LocationType = z.infer<typeof locationTypeSchema>;
export type OrderSource = z.infer<typeof orderSourceSchema>;

export interface CateringInquiry {
  date: string;
  partySize: number;
  location: string;
}
