"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SiteNavbar } from "../../components/SiteNavbar";
import { SiteFooter } from "../../components/HomeSections";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase(),
        password,
        redirect: false
      });

      if (result?.error) {
        setError(result.error);
        setSubmitting(false);
      } else if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content">
      <SiteNavbar />
      <section className="page-shell section reveal">
        <article className="panel auth-panel">
          <span className="eyebrow">Customer Login</span>
          <h1>Welcome Back</h1>
          <p>Sign in to access your orders, bookings, and rewards.</p>

          <form className="form-stack" onSubmit={onSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign In"}
            </button>

            <div className="auth-links">
              <Link href="/auth/reset-password">Forgot password?</Link>
              <span>•</span>
              <Link href="/auth/signup">Create account</Link>
            </div>
          </form>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
