import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin — Backyard BBQ King",
  description: "Unified admin operations for orders, catering, payments, and analytics."
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#121313" }}>
      {children}
    </div>
  );
}
