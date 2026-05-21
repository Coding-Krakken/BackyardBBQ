import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReserveClient } from "./ReserveClient";
import { featureFlags } from "../config/content";

export const metadata: Metadata = {
  title: "Reserve A Table",
  description:
    "Reserve your table at Backyard BBQ King for lunch, dinner, date nights, and celebrations with a streamlined online booking flow."
};

export default function ReservePage() {
  if (!featureFlags.isDineInEnabled) {
    redirect("/");
  }
  
  return <ReserveClient />;
}
