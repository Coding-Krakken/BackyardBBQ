import type { Metadata } from "next";
import { ReserveClient } from "./ReserveClient";

export const metadata: Metadata = {
  title: "Reserve A Table",
  description:
    "Reserve your table at Backyard BBQ King for lunch, dinner, date nights, and celebrations with a streamlined online booking flow."
};

export default function ReservePage() {
  return <ReserveClient />;
}
