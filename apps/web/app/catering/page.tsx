"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteFooter } from "../components/HomeSections";
import { SiteNavbar } from "../components/SiteNavbar";
import { FaqSection } from "../components/seo/FaqSection";
import { siteImages } from "../config/images";
import { calculateCateringPricing } from "../../lib/catering-pricing";
import { AnalyticsEvents, trackEvent } from "../lib/analytics";

type PackageKey = "Classic BBQ Package" | "Pitmaster Package" | "Premium Smokehouse Package" | "Food Truck Event Package";

type WizardStep = 1 | 2 | 3 | 4;

const PACKAGE_DETAILS: Record<PackageKey, {
  startingPerPersonCents: number;
  minGuests: number;
  eventTypes: string;
  includes: string[];
}> = {
  "Classic BBQ Package": {
    startingPerPersonCents: 2200,
    minGuests: 20,
    eventTypes: "Backyard parties, birthdays, school events",
    includes: [
      "2 smoked proteins sliced to order",
      "3 loaded sides and sauce set",
      "Disposable setup kit and serving line"
    ]
  },
  "Pitmaster Package": {
    startingPerPersonCents: 2600,
    minGuests: 35,
    eventTypes: "Corporate events, rehearsal dinners, premium socials",
    includes: [
      "3 premium proteins with pepper bark brisket",
      "4 sides, cornbread, and signature sauce flight",
      "Service timeline coordination and buffet styling"
    ]
  },
  "Premium Smokehouse Package": {
    startingPerPersonCents: 3200,
    minGuests: 50,
    eventTypes: "Weddings, galas, executive hospitality",
    includes: [
      "Chef-curated menu planning",
      "On-site pitmaster carving and event captain",
      "Premium dinnerware and post-service breakdown"
    ]
  },
  "Food Truck Event Package": {
    startingPerPersonCents: 2400,
    minGuests: 40,
    eventTypes: "Festivals, brand activations, neighborhood blocks",
    includes: [
      "High-throughput truck service lane",
      "Crowd-optimized menu mix",
      "Event ops checklist and staging plan"
    ]
  }
};

const faqItems = [
  {
    question: "How far in advance should I book?",
    answer: "For peak dates, 2-6 weeks is ideal. We can still review rush requests when production windows allow."
  },
  {
    question: "Do you deliver and set up?",
    answer: "Yes. Delivery and buffet setup are standard. Staffing upgrades are available for larger events."
  },
  {
    question: "Do you provide staff?",
    answer: "Premium and large events can include on-site service staff and a dedicated event captain."
  },
  {
    question: "Is there a guest minimum?",
    answer: "Yes, package minimums vary by tier. We recommend the family meal flow for smaller groups."
  },
  {
    question: "Can I customize the menu?",
    answer: "Absolutely. We can tailor proteins, sides, and service format to match your event."
  },
  {
    question: "How does the deposit work?",
    answer: "We capture your lead first. After availability review, we share optional deposit payment instructions."
  }
];

export default function CateringPage() {
  const [step, setStep] = useState<WizardStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("Corporate Event");
  const [eventAddress, setEventAddress] = useState("");
  const [partySize, setPartySize] = useState(50);
  const [packageName, setPackageName] = useState<PackageKey>("Classic BBQ Package");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  const pricing = useMemo(() => calculateCateringPricing({ partySize, packageName }), [partySize, packageName]);

  const selectedPackage = PACKAGE_DETAILS[packageName];

  const estimatedSubtotalCents = Math.max(pricing.estimatedTotalCents, selectedPackage.startingPerPersonCents * partySize);
  const estimatedDepositCents = Math.round(estimatedSubtotalCents * 0.3);
  const estimatedBalanceCents = estimatedSubtotalCents - estimatedDepositCents;

  const currency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const validateStep = (targetStep: WizardStep) => {
    if (targetStep > 1 && !eventDate) {
      setError("Please choose an event date before continuing.");
      return false;
    }
    if (targetStep > 2 && partySize < selectedPackage.minGuests) {
      setError(`${packageName} requires at least ${selectedPackage.minGuests} guests.`);
      return false;
    }
    if (targetStep > 3 && (!contactName || !contactEmail || !contactPhone)) {
      setError("Please complete contact details before review.");
      return false;
    }
    setError(null);
    return true;
  };

  const goToStep = (nextStep: WizardStep) => {
    if (validateStep(nextStep)) {
      if (nextStep === 2) {
        trackEvent(AnalyticsEvents.cateringQuoteStarted, { source: "catering_wizard", packageName });
      }
      setStep(nextStep);
    }
  };

  const submitInquiry = async () => {
    if (!validateStep(4)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/catering/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate,
          eventType,
          eventAddress,
          partySize,
          packageName,
          contactName,
          contactEmail,
          contactPhone,
          notes,
          estimatedSubtotalCents,
          estimatedDepositCents,
          estimatedBalanceCents
        })
      });

      const payload = (await response.json()) as { inquiryId?: string; error?: string };
      if (!response.ok || !payload.inquiryId) {
        throw new Error(payload.error ?? "Unable to submit catering quote.");
      }

      setSuccessId(payload.inquiryId);
      trackEvent(AnalyticsEvents.cateringQuoteSubmitted, {
        packageName,
        partySize,
        source: "catering_wizard"
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit inquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content">
      <SiteNavbar />

      <section className="subpage-hero reveal">
        <Image src={siteImages.catering.src} alt={siteImages.catering.alt} fill priority sizes="100vw" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="page-shell subpage-hero-content">
          <span className="hero-eyebrow">BBQ Catering</span>
          <h1>Premium BBQ Catering for Syracuse Events</h1>
          <p>
            From weddings to food-truck activations, build your quote fast with package guidance, real-time estimates,
            and a clear next-step workflow.
          </p>
          <div className="cta-row">
            <button className="btn btn-primary" type="button" onClick={() => goToStep(1)}>
              Get Catering Quote
            </button>
            <a className="btn btn-secondary" href="#packages">View Packages</a>
          </div>
        </div>
      </section>

      <section id="packages" className="page-shell section">
        <div className="section-heading">
          <span className="eyebrow">Packages</span>
          <h2>Choose the Right Catering Experience</h2>
        </div>
        <div className="package-grid">
          {(Object.keys(PACKAGE_DETAILS) as PackageKey[]).map((pkg) => {
            const details = PACKAGE_DETAILS[pkg];
            return (
              <article key={pkg} className="panel package-card">
                <h3>{pkg}</h3>
                <p><strong>Starting at {currency(details.startingPerPersonCents)} per guest</strong></p>
                <p>{details.eventTypes}</p>
                <p>Minimum guests: {details.minGuests}</p>
                <ul>
                  {details.includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <button className="btn btn-secondary" type="button" onClick={() => { setPackageName(pkg); goToStep(2); }}>
                  Select Package
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page-shell section story-grid">
        <article className="panel estimator-panel">
          <span className="eyebrow">Guest Estimator</span>
          <h3>Estimate Your Event Cost</h3>
          <label>
            Guest count
            <input type="number" min={1} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} />
          </label>
          <label>
            Package tier
            <select value={packageName} onChange={(event) => setPackageName(event.target.value as PackageKey)}>
              {(Object.keys(PACKAGE_DETAILS) as PackageKey[]).map((pkg) => (
                <option key={pkg} value={pkg}>{pkg}</option>
              ))}
            </select>
          </label>
          <div className="estimator-summary">
            <div><span>Estimated subtotal</span><strong>{currency(estimatedSubtotalCents)}</strong></div>
            <div><span>Estimated deposit</span><strong>{currency(estimatedDepositCents)}</strong></div>
            <div><span>Estimated balance</span><strong>{currency(estimatedBalanceCents)}</strong></div>
          </div>
        </article>

        <article className="panel wizard-panel">
          <span className="eyebrow">Quote Wizard</span>
          <h3>Step {step} of 4</h3>

          {successId ? (
            <div className="success-shell">
              <h4>Quote Request Submitted</h4>
              <p>
                Your inquiry reference is <strong>{successId}</strong>. We will confirm availability and send next steps,
                including optional deposit instructions, shortly.
              </p>
              <div className="cta-row">
                <Link className="btn btn-primary" href="/dashboard/bookings">View Dashboard</Link>
                <Link className="btn btn-secondary" href="/menu">Order Online Now</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="wizard-progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step}>
                {[1, 2, 3, 4].map((index) => (
                  <span key={index} className={index <= step ? "is-active" : ""} />
                ))}
              </div>

              {step === 1 ? (
                <div className="wizard-step">
                  <h4>Event Details</h4>
                  <label>
                    Event date
                    <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
                  </label>
                  <label>
                    Event type
                    <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
                      <option>Corporate Event</option>
                      <option>Wedding</option>
                      <option>Private Party</option>
                      <option>Festival / Public Event</option>
                    </select>
                  </label>
                  <label>
                    Event address
                    <input type="text" value={eventAddress} onChange={(event) => setEventAddress(event.target.value)} placeholder="Venue or street address" />
                  </label>
                  <button className="btn btn-primary" type="button" onClick={() => goToStep(2)}>Continue</button>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="wizard-step">
                  <h4>Package and Guest Count</h4>
                  <label>
                    Package
                    <select value={packageName} onChange={(event) => setPackageName(event.target.value as PackageKey)}>
                      {(Object.keys(PACKAGE_DETAILS) as PackageKey[]).map((pkg) => (
                        <option key={pkg} value={pkg}>{pkg}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Guest count
                    <input type="number" min={1} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} />
                  </label>
                  <div className="wizard-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>Back</button>
                    <button className="btn btn-primary" type="button" onClick={() => goToStep(3)}>Continue</button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="wizard-step">
                  <h4>Contact Details</h4>
                  <label>
                    Name
                    <input type="text" value={contactName} onChange={(event) => setContactName(event.target.value)} />
                  </label>
                  <label>
                    Email
                    <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
                  </label>
                  <label>
                    Phone
                    <input type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                  </label>
                  <label>
                    Notes
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Menu requests, setup timing, staffing notes" />
                  </label>
                  <div className="wizard-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setStep(2)}>Back</button>
                    <button className="btn btn-primary" type="button" onClick={() => goToStep(4)}>Continue</button>
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="wizard-step">
                  <h4>Review and Submit</h4>
                  <ul>
                    <li>Date: {eventDate || "Not set"}</li>
                    <li>Event type: {eventType}</li>
                    <li>Package: {packageName}</li>
                    <li>Guests: {partySize}</li>
                    <li>Contact: {contactName} ({contactEmail})</li>
                  </ul>
                  <p>Estimated total: <strong>{currency(estimatedSubtotalCents)}</strong></p>
                  <p>Estimated deposit request: <strong>{currency(estimatedDepositCents)}</strong></p>
                  <div className="wizard-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setStep(3)}>Back</button>
                    <button className="btn btn-primary" type="button" disabled={submitting} onClick={submitInquiry}>
                      {submitting ? "Submitting..." : "Submit Catering Quote"}
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? <p className="status-text" style={{ marginTop: "0.8rem" }}>{error}</p> : null}
            </>
          )}
        </article>
      </section>

      <section className="page-shell section">
        <FaqSection title="Catering FAQ" items={faqItems} />
      </section>

      <SiteFooter />

      <style jsx>{`
        .package-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }

        .package-card ul {
          margin: 0.6rem 0 1rem;
          padding-left: 1.1rem;
          color: var(--warm-gray);
        }

        .estimator-panel,
        .wizard-panel {
          display: grid;
          gap: 0.75rem;
        }

        label {
          display: grid;
          gap: 0.35rem;
          color: var(--warm-gray);
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 0.6rem;
          background: rgba(16, 32, 41, 0.7);
          color: var(--cream);
          min-height: 2.7rem;
          padding: 0.6rem 0.75rem;
        }

        textarea {
          min-height: 6rem;
          resize: vertical;
        }

        .estimator-summary {
          display: grid;
          gap: 0.45rem;
          margin-top: 0.4rem;
          padding: 0.7rem;
          border: 1px solid var(--line);
          border-radius: 0.6rem;
        }

        .estimator-summary div {
          display: flex;
          justify-content: space-between;
        }

        .wizard-progress {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.35rem;
        }

        .wizard-progress span {
          height: 0.35rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
        }

        .wizard-progress span.is-active {
          background: var(--ember);
        }

        .wizard-step {
          display: grid;
          gap: 0.65rem;
        }

        .wizard-step ul {
          margin: 0;
          padding-left: 1rem;
          color: var(--warm-gray);
        }

        .wizard-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
          margin-top: 0.4rem;
        }

        .success-shell {
          display: grid;
          gap: 0.75rem;
        }

        @media (max-width: 1100px) {
          .package-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .package-grid {
            grid-template-columns: 1fr;
          }

          .wizard-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
