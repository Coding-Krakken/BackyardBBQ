import type { PropsWithChildren } from "react";

export function SectionCard({ children }: PropsWithChildren) {
  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "14px",
        background: "rgba(0,0,0,0.2)",
        padding: "1rem"
      }}
    >
      {children}
    </section>
  );
}
