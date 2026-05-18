"use client";

import { useMemo, useState } from "react";
import { SiteNavbar } from "../components/SiteNavbar";
import { SiteFooter } from "../components/HomeSections";
import { reservationSchema, type ReservationFormData } from "../lib/validation";
import { submitReservation } from "../lib/services/reservation-service";
import { AnalyticsEvents, trackEvent } from "../lib/analytics";

type TimeSlotStatus = "available" | "limited" | "booked";

const timeSlots: Array<{ time: string; status: TimeSlotStatus }> = [
  { time: "11:30 AM", status: "available" },
  { time: "12:30 PM", status: "limited" },
  { time: "1:30 PM", status: "available" },
  { time: "5:00 PM", status: "booked" },
  { time: "6:30 PM", status: "limited" },
  { time: "8:00 PM", status: "available" }
];

const initialFormState: ReservationFormData = {
  name: "",
  email: "",
  phone: "",
  date: "",
  time: "",
  partySize: 2,
  occasion: "",
  specialRequests: ""
};

export function ReserveClient() {
  const [form, setForm] = useState<ReservationFormData>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof ReservationFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmationId, setConfirmationId] = useState("");

  const hasSubmitted = Boolean(confirmationId);

  const availabilityLabel = useMemo(() => {
    if (!form.time) {
      return "Select a time slot to view availability.";
    }

    const match = timeSlots.find((slot) => slot.time === form.time);
    if (!match) {
      return "Custom time selected. Availability will be confirmed by our host team.";
    }

    if (match.status === "available") {
      return "Great choice. This time currently has open seating.";
    }

    if (match.status === "limited") {
      return "This seating window is filling up. We recommend submitting now.";
    }

    return "This time slot is likely fully booked. Try another option.";
  }, [form.time]);

  const handleChange = (field: keyof ReservationFormData, value: string | number) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setSubmitError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = reservationSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof ReservationFormData, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ReservationFormData;
        if (!nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await submitReservation(parsed.data);
      setConfirmationId(response.reservationId);
      trackEvent(AnalyticsEvents.reservationSubmitted, {
        partySize: parsed.data.partySize,
        occasion: parsed.data.occasion || "none"
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit reservation right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="main-content">
      <SiteNavbar />
      <section className="subpage-hero reveal">
        <div className="hero-overlay" />
        <div className="page-shell subpage-hero-content narrow">
          <span className="hero-eyebrow">Table Reservations</span>
          <h1>Reserve Your Table</h1>
          <p>
            Book lunch, date night, or a family dinner with a reservation flow designed for fast mobile booking.
          </p>
        </div>
      </section>

      <section className="page-shell section reserve-grid">
        <article className="panel reserve-panel">
          {!hasSubmitted ? (
            <>
              <span className="eyebrow">Reservation Details</span>
              <h2>Table Booking Form</h2>
              <p>Choose your date and seating time. For large events, please use our catering flow.</p>

              <form className="reserve-form" onSubmit={handleSubmit} noValidate>
                <label>
                  Full name
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => handleChange("name", event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name ? <span className="error-text">{errors.name}</span> : null}
                </label>

                <div className="reserve-row">
                  <label>
                    Email
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => handleChange("email", event.target.value)}
                      aria-invalid={Boolean(errors.email)}
                    />
                    {errors.email ? <span className="error-text">{errors.email}</span> : null}
                  </label>

                  <label>
                    Phone
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => handleChange("phone", event.target.value)}
                      aria-invalid={Boolean(errors.phone)}
                    />
                    {errors.phone ? <span className="error-text">{errors.phone}</span> : null}
                  </label>
                </div>

                <div className="reserve-row">
                  <label>
                    Date
                    <input
                      type="date"
                      value={form.date}
                      onChange={(event) => handleChange("date", event.target.value)}
                      aria-invalid={Boolean(errors.date)}
                    />
                    {errors.date ? <span className="error-text">{errors.date}</span> : null}
                  </label>

                  <label>
                    Time
                    <select
                      value={form.time}
                      onChange={(event) => handleChange("time", event.target.value)}
                      aria-invalid={Boolean(errors.time)}
                    >
                      <option value="">Select a time</option>
                      {timeSlots.map((slot) => (
                        <option key={slot.time} value={slot.time} disabled={slot.status === "booked"}>
                          {slot.time} {slot.status === "booked" ? "(Booked)" : slot.status === "limited" ? "(Limited)" : ""}
                        </option>
                      ))}
                    </select>
                    {errors.time ? <span className="error-text">{errors.time}</span> : null}
                  </label>
                </div>

                <div className="reserve-row">
                  <label>
                    Party size
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={form.partySize}
                      onChange={(event) => handleChange("partySize", Number(event.target.value))}
                      aria-invalid={Boolean(errors.partySize)}
                    />
                    {errors.partySize ? <span className="error-text">{errors.partySize}</span> : null}
                  </label>

                  <label>
                    Occasion
                    <select value={form.occasion} onChange={(event) => handleChange("occasion", event.target.value)}>
                      <option value="">Select (optional)</option>
                      <option value="Date Night">Date Night</option>
                      <option value="Birthday">Birthday</option>
                      <option value="Anniversary">Anniversary</option>
                      <option value="Business Dinner">Business Dinner</option>
                      <option value="Family Gathering">Family Gathering</option>
                    </select>
                  </label>
                </div>

                <label>
                  Special requests
                  <textarea
                    rows={4}
                    value={form.specialRequests}
                    onChange={(event) => handleChange("specialRequests", event.target.value)}
                  />
                </label>

                {submitError ? <p className="error-text form-error">{submitError}</p> : null}

                <button type="submit" className="btn btn-primary reserve-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Reservation"}
                </button>
              </form>
            </>
          ) : (
            <div className="reserve-success">
              <span className="eyebrow">Reservation Confirmed</span>
              <h2>You Are On The Book</h2>
              <p>
                Your request is received with confirmation ID <strong>{confirmationId}</strong>. Our host team will send
                a final confirmation by email or phone shortly.
              </p>
              <div className="cta-row">
                <a href="/menu" className="btn btn-secondary">Browse Menu</a>
                <a href="/dashboard" className="btn btn-secondary">Go To Dashboard</a>
              </div>
            </div>
          )}
        </article>

        <aside className="panel availability-panel">
          <span className="eyebrow">Live Availability</span>
          <h3>Today&apos;s Seating Outlook</h3>
          <p>{availabilityLabel}</p>
          <ul className="availability-list" aria-label="Table availability time slots">
            {timeSlots.map((slot) => (
              <li key={slot.time} className={`availability-pill ${slot.status}`}>
                <span>{slot.time}</span>
                <strong>
                  {slot.status === "available"
                    ? "Available"
                    : slot.status === "limited"
                    ? "Limited"
                    : "Booked"}
                </strong>
              </li>
            ))}
          </ul>
          <p className="availability-note">
            Need private dining or over 20 guests? Use the catering quote flow for premium event service.
          </p>
        </aside>
      </section>

      <SiteFooter />

      <style jsx>{`
        .reserve-grid {
          display: grid;
          gap: 1.5rem;
          grid-template-columns: 1.4fr 1fr;
          align-items: start;
        }

        .reserve-form {
          display: grid;
          gap: 1rem;
          margin-top: 1rem;
        }

        .reserve-form label {
          display: grid;
          gap: 0.45rem;
          font-size: 0.95rem;
          color: var(--warm-gray);
        }

        .reserve-form input,
        .reserve-form select,
        .reserve-form textarea {
          width: 100%;
          border: 1px solid var(--line);
          background: rgba(16, 32, 41, 0.7);
          color: var(--cream);
          border-radius: 0.6rem;
          min-height: 2.75rem;
          padding: 0.65rem 0.75rem;
        }

        .reserve-form textarea {
          min-height: 8rem;
          resize: vertical;
        }

        .reserve-row {
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .reserve-submit {
          width: 100%;
          min-height: 2.9rem;
          margin-top: 0.35rem;
        }

        .error-text {
          color: #ff9980;
          font-size: 0.85rem;
        }

        .form-error {
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 153, 128, 0.35);
          background: rgba(255, 102, 66, 0.12);
        }

        .availability-list {
          list-style: none;
          margin: 1rem 0 0;
          padding: 0;
          display: grid;
          gap: 0.6rem;
        }

        .availability-pill {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 0.55rem 0.85rem;
          background: rgba(16, 32, 41, 0.5);
          color: var(--cream);
          font-size: 0.9rem;
        }

        .availability-pill.available strong {
          color: #8be7a5;
        }

        .availability-pill.limited strong {
          color: #ffd580;
        }

        .availability-pill.booked strong {
          color: #ff9980;
        }

        .availability-note {
          margin-top: 1rem;
          color: var(--warm-gray);
          font-size: 0.92rem;
        }

        .reserve-success {
          display: grid;
          gap: 0.85rem;
        }

        @media (max-width: 980px) {
          .reserve-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .reserve-row {
            grid-template-columns: 1fr;
          }

          .reserve-form input,
          .reserve-form select,
          .reserve-form textarea,
          .reserve-submit {
            font-size: 1rem;
          }
        }
      `}</style>
    </main>
  );
}
