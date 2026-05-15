"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid credentials or insufficient permissions.");
    } else {
      router.replace("/");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "2.5rem", background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12 }}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", color: "#fff" }}>Admin Dashboard</h1>
        <p style={{ margin: "0 0 2rem", fontSize: "0.875rem", color: "#888" }}>Backyard BBQ King — staff access only</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.875rem", color: "#ccc" }}>
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              style={{ padding: "0.625rem 0.75rem", background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: "1rem", outline: "none" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.875rem", color: "#ccc" }}>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={{ padding: "0.625rem 0.75rem", background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: "1rem", outline: "none" }}
            />
          </label>

          {error && (
            <p style={{ margin: 0, padding: "0.625rem 0.75rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "#f87171", fontSize: "0.875rem" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: "0.5rem", padding: "0.75rem", background: loading ? "#444" : "#e05c1a", border: "none", borderRadius: 6, color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
