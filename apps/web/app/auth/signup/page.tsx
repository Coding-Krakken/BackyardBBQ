"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { FormEvent, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteNavbar } from "../../components/SiteNavbar";
import { SiteFooter } from "../../components/HomeSections";
import { AnalyticsEvents, trackEvent } from "../../lib/analytics";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, [searchParams]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    trackEvent(AnalyticsEvents.signupStarted, { source: "auth_signup" });

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setSubmitting(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
          firstName,
          lastName,
          phone,
          referralCode: referralCode || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create account");
        setSubmitting(false);
        return;
      }

      // Redirect to login page with success message
      router.push("/auth/login?registered=true");
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
          <span className="eyebrow">Create Account</span>
          <h1>Join Backyard BBQ King</h1>
          <p>Create an account to track orders, manage bookings, and earn rewards.</p>

          {referralCode && (
            <div style={{
              marginTop: "1.5rem",
              padding: "1rem",
              background: "rgba(217, 109, 49, 0.15)",
              border: "1px solid var(--ember)",
              borderRadius: "8px",
              textAlign: "center"
            }}>
              <p style={{ margin: 0, color: "var(--cream)", fontWeight: 500 }}>
                🎉 You've been referred by a friend!
              </p>
              <p style={{ margin: "0.5rem 0 0 0", color: "var(--warm-gray)", fontSize: "0.9rem" }}>
                Get $5 off your first order when you sign up
              </p>
            </div>
          )}

          <form className="form-stack" onSubmit={onSubmit}>
            <div className="form-row">
              <label>
                First Name
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                  autoComplete="given-name"
                />
              </label>

              <label>
                Last Name
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </label>
            </div>

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
              Phone (optional)
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                autoComplete="tel"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </label>

            <label>
              Confirm Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create Account"}
            </button>

            <div className="auth-links">
              <span>Already have an account?</span>
              <Link href="/auth/login">Sign in</Link>
            </div>
          </form>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <main id="main-content">
        <SiteNavbar />
        <section className="page-shell section reveal">
          <article className="panel auth-panel">
            <p style={{ color: "var(--warm-gray)" }}>Loading...</p>
          </article>
        </section>
        <SiteFooter />
      </main>
    }>
      <SignupForm />
    </Suspense>
  );
}

