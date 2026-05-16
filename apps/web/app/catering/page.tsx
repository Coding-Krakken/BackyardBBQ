"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter } from "../components/HomeSections";
import { SiteNavbar } from "../components/SiteNavbar";
import { businessInfo } from "../config/content";
import { siteImages } from "../config/images";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

type AvailabilityResponse = {
  date: string;
  partySize: number;
  available: boolean;
  remainingCapacity: number;
  nextSteps: string;
};

type BookingResponse = {
  booking: {
    id: string;
    status: string;
    depositCents?: number;
    estimatedTotalCents?: number;
  };
  message: string;
};

export default function CateringPage() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [partySize, setPartySize] = useState(50);
  const [packageName, setPackageName] = useState("Classic Smokehouse");
  const [eventAddress, setEventAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<AvailabilityResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    if (!apiBaseUrl) {
      setErrorMessage("Availability checks are unavailable because API base URL is not configured in this environment.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/catering/availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          date,
          partySize
        })
      });

      if (!response.ok) {
        throw new Error("Unable to check availability.");
      }

      const payload = (await response.json()) as AvailabilityResponse;
      setResult(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to check availability.");
    }

    setSubmitting(false);
  };

  const createBooking = async () => {
    setErrorMessage(null);
    setBookingMessage(null);
    setCreatingBooking(true);

    try {
      const response = await fetch("/api/catering/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          eventDate: date,
          partySize,
          packageName,
          eventAddress: eventAddress || undefined,
          notes: notes || undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to create booking.");
      }

      const payload = (await response.json()) as BookingResponse;
      setBookingMessage(payload.message);

      if (payload.booking.status === "approved") {
        router.push(`/catering/bookings/${payload.booking.id}/deposit`);
        return;
      }

      router.push("/dashboard/bookings");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create booking.");
    } finally {
      setCreatingBooking(false);
    }
  };

  return (
    <main id="main-content">
      <SiteNavbar />
      <section className="subpage-hero reveal">
        <Image src={siteImages.catering.src} alt={siteImages.catering.alt} fill priority sizes="100vw" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="page-shell subpage-hero-content">
          <span className="hero-eyebrow">Catering Concierge</span>
          <h1>Plan a Premium BBQ Event Experience</h1>
          <p>
            From executive luncheons to large wedding receptions, we tailor each menu and service flow to your
            timeline, guest count, and venue logistics.
          </p>
        </div>
      </section>

      <section className="page-shell section story-grid reveal">
        <article className="panel booking-panel">
          <span className="eyebrow">Live Availability</span>
          <h2>Catering Booking Wizard</h2>
          <p>Enter your event date and party size to check current smokehouse production capacity.</p>

          <form className="form-stack" onSubmit={onSubmit}>
            <label>
              Event Date
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>

            <label>
              Party Size
              <input
                type="number"
                min={1}
                value={partySize}
                onChange={(event) => setPartySize(Number(event.target.value))}
                required
              />
            </label>

            <label>
              Catering Package
              <select value={packageName} onChange={(event) => setPackageName(event.target.value)}>
                <option value="Classic Smokehouse">Classic Smokehouse</option>
                <option value="Premium Pitmaster">Premium Pitmaster</option>
                <option value="Executive Catering">Executive Catering</option>
              </select>
            </label>

            <label>
              Event Address (Optional)
              <input
                type="text"
                value={eventAddress}
                onChange={(event) => setEventAddress(event.target.value)}
                placeholder="123 Main St, City, State"
              />
            </label>

            <label>
              Notes (Optional)
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Special dietary needs, setup details, or timeline notes"
                rows={4}
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Checking..." : "Check Availability"}
            </button>
          </form>

          {errorMessage ? <p className="status-text">{errorMessage}</p> : null}

          {result ? (
            <article className="booking-result" aria-live="polite">
              <strong>{result.available ? "Date Available" : "Date Not Available"}</strong>
              <div>Remaining capacity: {result.remainingCapacity}</div>
              <div>{result.nextSteps}</div>
              {result.available ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  style={{ marginTop: "1rem" }}
                  onClick={createBooking}
                  disabled={creatingBooking}
                >
                  {creatingBooking ? "Creating Booking..." : "Create Booking Request"}
                </button>
              ) : null}
            </article>
          ) : null}
          {bookingMessage ? <p className="status-text">{bookingMessage}</p> : null}
        </article>

        <article className="panel booking-meta">
          <span className="eyebrow">Event Support</span>
          <h3>What You Get</h3>
          <ul>
            <li>Menu strategy for weddings, corporate, and private events</li>
            <li>On-site setup with premium tray and buffet presentation</li>
            <li>Flexible service formats for plated, buffet, or truck activation</li>
            <li>Coordinated prep windows to keep smoke quality at peak freshness</li>
          </ul>
          <div className="booking-contact">
            <p>{businessInfo.phone}</p>
            <p>{businessInfo.email}</p>
            <p>{businessInfo.cateringAvailability}</p>
          </div>
          <Link className="btn btn-secondary" href="/dashboard/bookings">
            View My Booking Requests
          </Link>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
