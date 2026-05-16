"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { FormEvent, useState } from "react";
import { SiteNavbar } from "../../components/SiteNavbar";
import { SiteFooter } from "../../components/HomeSections";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <main id="main-content">
      <SiteNavbar />
      <section className="page-shell section reveal">
        <article className="panel auth-panel">
          <span className="eyebrow">Password Reset</span>
          <h1>Reset Your Password</h1>

          {!submitted ? (
            <>
              <p>
                Enter your email address and we'll send you instructions to reset your password.
              </p>

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

                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "Sending..." : "Send Reset Instructions"}
                </button>

                <div className="auth-links">
                  <Link href="/auth/login">Back to sign in</Link>
                </div>
              </form>
            </>
          ) : (
            <>
              <p className="success-text">
                If an account exists with <strong>{email}</strong>, you'll receive password reset
                instructions shortly.
              </p>

              <div className="auth-links">
                <Link href="/auth/login">Back to sign in</Link>
              </div>
            </>
          )}
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
