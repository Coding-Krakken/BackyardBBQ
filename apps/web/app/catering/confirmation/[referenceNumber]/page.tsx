"use client";

import Link from "next/link";
import { SiteFooter } from "../../../components/HomeSections";
import { SiteNavbar } from "../../../components/SiteNavbar";

interface ConfirmationPageProps {
  params: { referenceNumber: string };
}

export default function CateringConfirmationPage({ params }: ConfirmationPageProps) {
  const { referenceNumber } = params;

  return (
    <main id="main-content">
      <SiteNavbar />

      <section className="page-shell section confirmation-section">
        <div className="panel confirmation-card">
          <div className="success-icon" aria-hidden="true">✓</div>
          <h1>Inquiry Submitted!</h1>
          <p className="reference">
            Your reference number: <strong>{referenceNumber}</strong>
          </p>
          <p className="subtitle">
            We&apos;ve received your catering request and sent a confirmation to your email.
          </p>

          <div className="next-steps">
            <h2>What Happens Next</h2>
            <ol>
              <li>Our team will review your inquiry and <strong>contact you within 24 hours</strong> to discuss your event.</li>
              <li>We&apos;ll work together to finalize your custom menu, logistics, and pricing.</li>
              <li>Once confirmed, a <strong>65% deposit</strong> secures your date.</li>
              <li><strong>Full payment</strong> is due 7 days before your event.</li>
            </ol>
          </div>

          <div className="policy-summary">
            <h3>Cancellation Policy</h3>
            <ul>
              <li>Cancel <strong>3+ days before</strong> your event → full deposit refund</li>
              <li>Cancel <strong>less than 3 days before</strong> → 50% of total payment refunded</li>
            </ul>
          </div>

          <div className="cta-row">
            <Link className="btn btn-primary" href="/menu">Browse Our Menu</Link>
            <Link className="btn btn-secondary" href="/">Back to Home</Link>
          </div>
        </div>
      </section>

      <SiteFooter />

      <style jsx>{`
        .confirmation-section {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem 1rem;
        }

        .confirmation-card {
          max-width: 40rem;
          margin: 0 auto;
          text-align: center;
          display: grid;
          gap: 1.5rem;
          padding: 3rem 2rem;
        }

        .success-icon {
          width: 4rem;
          height: 4rem;
          border-radius: 50%;
          background: var(--ember);
          color: white;
          font-size: 2rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .reference {
          font-size: 1.15rem;
          color: var(--cream);
        }

        .subtitle {
          color: var(--warm-gray);
        }

        .next-steps,
        .policy-summary {
          text-align: left;
          padding: 1.25rem;
          border: 1px solid var(--line);
          border-radius: 0.6rem;
          background: rgba(16, 32, 41, 0.5);
        }

        .next-steps h2,
        .policy-summary h3 {
          margin-bottom: 0.75rem;
          font-size: 1.1rem;
        }

        .next-steps ol,
        .policy-summary ul {
          margin: 0;
          padding-left: 1.2rem;
          color: var(--warm-gray);
          line-height: 1.8;
        }

        .cta-row {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 0.5rem;
        }

        @media (max-width: 768px) {
          .confirmation-card {
            padding: 2rem 1.25rem;
          }
        }
      `}</style>
    </main>
  );
}
