"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteFooter } from "../components/HomeSections";
import { SiteNavbar } from "../components/SiteNavbar";
import { FaqSection } from "../components/seo/FaqSection";
import { siteImages } from "../config/images";
import { AnalyticsEvents, trackEvent } from "../lib/analytics";

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
    question: "Can I customize the menu?",
    answer: "Absolutely. All of our catering is fully custom — tell us what you want and we'll make it happen."
  },
  {
    question: "Is there a guest minimum?",
    answer: "We require a minimum of 10 guests for catering events."
  },
  {
    question: "How does the deposit work?",
    answer: "A 65% deposit is required to secure your date. Full payment is due 7 days before your event."
  },
  {
    question: "What is the cancellation policy?",
    answer: "Cancel 3+ days before your event for a full deposit refund. Cancellations less than 3 days before receive a 50% refund of total payment."
  }
];

interface FormErrors {
  eventDate?: string;
  partySize?: string;
  eventLocation?: string;
  foodPreferences?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export default function CateringPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const [eventDate, setEventDate] = useState("");
  const [partySize, setPartySize] = useState<number | "">("");
  const [eventLocation, setEventLocation] = useState("");
  const [foodPreferences, setFoodPreferences] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!eventDate) errors.eventDate = "Event date is required";
    if (!partySize || partySize < 10) errors.partySize = "Minimum 10 guests required";
    if (!eventLocation || eventLocation.length < 3) errors.eventLocation = "Please provide an event location";
    if (!foodPreferences || foodPreferences.length < 10) errors.foodPreferences = "Please describe what you'd like (at least 10 characters)";
    if (!contactName || contactName.length < 2) errors.contactName = "Name is required";
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errors.contactEmail = "Valid email is required";
    if (!contactPhone || contactPhone.length < 7) errors.contactPhone = "Valid phone number is required";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/catering/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate,
          partySize,
          eventLocation,
          foodPreferences,
          contactName,
          contactEmail,
          contactPhone,
          additionalNotes: additionalNotes || undefined,
        })
      });

      const payload = (await response.json()) as { referenceNumber?: string; error?: string; details?: unknown };
      if (!response.ok || !payload.referenceNumber) {
        throw new Error(payload.error ?? "Unable to submit catering inquiry.");
      }

      trackEvent(AnalyticsEvents.cateringQuoteSubmitted, {
        partySize,
        source: "catering_form"
      });

      router.push(`/catering/confirmation/${payload.referenceNumber}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit inquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  // Minimum date is tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0] ?? "";

  return (
    <main id="main-content">
      <SiteNavbar />

      <section className="subpage-hero reveal">
        <Image src={siteImages.catering.src} alt={siteImages.catering.alt} fill priority sizes="100vw" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="page-shell subpage-hero-content">
          <span className="hero-eyebrow">Custom BBQ Catering</span>
          <h1>Custom BBQ Catering for Your Event</h1>
          <p>
            Every event is unique. Tell us about yours and we&apos;ll craft a custom BBQ experience
            tailored to your guests, venue, and vision.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#inquiry-form">Request a Quote</a>
          </div>
        </div>
      </section>

      <section className="page-shell section">
        <div className="section-heading">
          <span className="eyebrow">How It Works</span>
          <h2>Three Simple Steps</h2>
        </div>
        <div className="steps-grid">
          <article className="panel step-card">
            <span className="step-number">1</span>
            <h3>Tell Us About Your Event</h3>
            <p>Fill out the form below with your event details, food preferences, and contact information.</p>
          </article>
          <article className="panel step-card">
            <span className="step-number">2</span>
            <h3>We&apos;ll Get In Touch</h3>
            <p>Our team will contact you within 24 hours to discuss your menu, logistics, and finalize pricing.</p>
          </article>
          <article className="panel step-card">
            <span className="step-number">3</span>
            <h3>Secure Your Date</h3>
            <p>A 65% deposit locks in your event. Full payment is due 7 days before the big day.</p>
          </article>
        </div>
      </section>

      <section id="inquiry-form" className="page-shell section">
        <div className="section-heading">
          <span className="eyebrow">Get Started</span>
          <h2>Request a Custom Catering Quote</h2>
          <p>All catering is fully custom — tell us your vision and we&apos;ll make it happen.</p>
        </div>

        <form className="panel inquiry-form" onSubmit={submitInquiry} noValidate>
          <fieldset className="form-section">
            <legend>Event Details</legend>
            <div className="form-grid">
              <label>
                <span className="label-text">Event Date <span className="required">*</span></span>
                <input
                  type="date"
                  value={eventDate}
                  min={minDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  aria-invalid={!!fieldErrors.eventDate}
                  aria-describedby={fieldErrors.eventDate ? "error-eventDate" : undefined}
                />
                {fieldErrors.eventDate ? <span id="error-eventDate" className="field-error">{fieldErrors.eventDate}</span> : null}
              </label>
              <label>
                <span className="label-text">Number of Guests <span className="required">*</span></span>
                <input
                  type="number"
                  min={10}
                  placeholder="Minimum 10 guests"
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value ? Number(e.target.value) : "")}
                  aria-invalid={!!fieldErrors.partySize}
                  aria-describedby={fieldErrors.partySize ? "error-partySize" : undefined}
                />
                {fieldErrors.partySize ? <span id="error-partySize" className="field-error">{fieldErrors.partySize}</span> : null}
              </label>
              <label className="full-width">
                <span className="label-text">Event Location <span className="required">*</span></span>
                <input
                  type="text"
                  placeholder="Venue name, address, or general area"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  aria-invalid={!!fieldErrors.eventLocation}
                  aria-describedby={fieldErrors.eventLocation ? "error-eventLocation" : undefined}
                />
                {fieldErrors.eventLocation ? <span id="error-eventLocation" className="field-error">{fieldErrors.eventLocation}</span> : null}
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Food Preferences</legend>
            <label>
              <span className="label-text">What would you like us to prepare? <span className="required">*</span></span>
              <textarea
                rows={5}
                placeholder="Tell us about proteins, sides, dietary restrictions, serving style, or anything else. Example: 'Pulled pork and brisket for 50, with mac & cheese, coleslaw, and cornbread. Need a vegetarian option too.'"
                value={foodPreferences}
                onChange={(e) => setFoodPreferences(e.target.value)}
                aria-invalid={!!fieldErrors.foodPreferences}
                aria-describedby={fieldErrors.foodPreferences ? "error-foodPreferences" : undefined}
              />
              {fieldErrors.foodPreferences ? <span id="error-foodPreferences" className="field-error">{fieldErrors.foodPreferences}</span> : null}
            </label>
            <label>
              <span className="label-text">Additional Notes</span>
              <textarea
                rows={3}
                placeholder="Timing preferences, setup needs, allergies, budget considerations, etc."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="form-section">
            <legend>Contact Information</legend>
            <div className="form-grid">
              <label>
                <span className="label-text">Your Name <span className="required">*</span></span>
                <input
                  type="text"
                  placeholder="Full name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  aria-invalid={!!fieldErrors.contactName}
                  aria-describedby={fieldErrors.contactName ? "error-contactName" : undefined}
                />
                {fieldErrors.contactName ? <span id="error-contactName" className="field-error">{fieldErrors.contactName}</span> : null}
              </label>
              <label>
                <span className="label-text">Email <span className="required">*</span></span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  aria-invalid={!!fieldErrors.contactEmail}
                  aria-describedby={fieldErrors.contactEmail ? "error-contactEmail" : undefined}
                />
                {fieldErrors.contactEmail ? <span id="error-contactEmail" className="field-error">{fieldErrors.contactEmail}</span> : null}
              </label>
              <label>
                <span className="label-text">Phone <span className="required">*</span></span>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  aria-invalid={!!fieldErrors.contactPhone}
                  aria-describedby={fieldErrors.contactPhone ? "error-contactPhone" : undefined}
                />
                {fieldErrors.contactPhone ? <span id="error-contactPhone" className="field-error">{fieldErrors.contactPhone}</span> : null}
              </label>
            </div>
          </fieldset>

          <div className="policy-notice">
            <h4>Payment &amp; Cancellation Policy</h4>
            <ul>
              <li>A <strong>65% deposit</strong> is required to secure your booking date.</li>
              <li><strong>Full payment</strong> is due 7 days before the scheduled event.</li>
              <li>Cancel <strong>3+ days before</strong> your event: full deposit refund.</li>
              <li>Cancel <strong>less than 3 days before</strong>: 50% of total payment refunded.</li>
            </ul>
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="btn btn-primary submit-btn" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Catering Inquiry"}
          </button>
        </form>
      </section>

      <section className="page-shell section">
        <FaqSection title="Catering FAQ" items={faqItems} />
      </section>

      <SiteFooter />

      <style jsx>{`
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.5rem;
        }

        .step-card {
          display: grid;
          gap: 0.5rem;
          text-align: center;
          padding: 2rem 1.5rem;
        }

        .step-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: var(--ember);
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
          margin: 0 auto 0.5rem;
        }

        .inquiry-form {
          max-width: 48rem;
          margin: 0 auto;
          display: grid;
          gap: 2rem;
          padding: 2rem;
        }

        .form-section {
          border: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 1rem;
        }

        .form-section legend {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--cream);
          margin-bottom: 0.5rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        label {
          display: grid;
          gap: 0.35rem;
        }

        .label-text {
          color: var(--warm-gray);
          font-size: 0.9rem;
        }

        .required {
          color: var(--ember);
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 0.6rem;
          background: rgba(16, 32, 41, 0.7);
          color: var(--cream);
          min-height: 2.7rem;
          padding: 0.6rem 0.75rem;
          font-size: 0.95rem;
          transition: border-color 0.2s;
        }

        input:focus,
        textarea:focus {
          outline: none;
          border-color: var(--ember);
        }

        input[aria-invalid="true"],
        textarea[aria-invalid="true"] {
          border-color: #ef4444;
        }

        textarea {
          min-height: 6rem;
          resize: vertical;
        }

        .field-error {
          color: #ef4444;
          font-size: 0.8rem;
        }

        .policy-notice {
          padding: 1.25rem;
          border: 1px solid var(--line);
          border-radius: 0.6rem;
          background: rgba(16, 32, 41, 0.5);
        }

        .policy-notice h4 {
          margin-bottom: 0.5rem;
          color: var(--cream);
        }

        .policy-notice ul {
          margin: 0;
          padding-left: 1.2rem;
          color: var(--warm-gray);
          line-height: 1.8;
        }

        .form-error {
          color: #ef4444;
          padding: 0.75rem;
          border: 1px solid #ef4444;
          border-radius: 0.6rem;
          background: rgba(239, 68, 68, 0.1);
        }

        .submit-btn {
          justify-self: center;
          min-width: 16rem;
          padding: 0.9rem 2rem;
          font-size: 1.05rem;
        }

        @media (max-width: 768px) {
          .steps-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .inquiry-form {
            padding: 1.25rem;
          }
        }
      `}</style>
    </main>
  );
}
