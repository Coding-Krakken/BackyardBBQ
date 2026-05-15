import "./globals.css";
import type { Metadata } from "next";
import { SessionProvider } from "./SessionProvider";

export const metadata: Metadata = {
  title: "Backyard BBQ King Admin",
  description: "Unified operations for orders, catering, payments, and analytics."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
