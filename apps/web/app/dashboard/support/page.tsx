"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader, DashboardSidebar } from "../components/DashboardLayout";
import Link from "next/link";
import { businessInfo, featureFlags } from "../../config/content";
function getFaqItems() {
  return [
    {
    question: "How do I track my order?",
    answer: "You can track your order in real-time from your Dashboard. Navigate to the Orders page to see your active orders with live status updates. We'll also send you notifications as your order progresses."
  },
  {
    question: "Can I modify or cancel my order?",
    answer: "Orders can be modified or cancelled within 15 minutes of placement. After that, please call us directly at the number below and we'll do our best to accommodate your request."
  },
  {
    question: "What are your catering minimums?",
    answer: "Our catering services require a minimum of 20 people. We offer full-service catering with setup, serving, and cleanup for events of all sizes. Contact us at least 48 hours in advance for catering inquiries."
  },
  {
    question: "Do you offer delivery?",
    answer: "Yes! We offer direct delivery within 10 miles of our location. We also partner with DoorDash, Uber Eats, and Grubhub for wider delivery coverage. Delivery fees and times vary by service."
  },
  {
    question: "How do I use my referral credits?",
    answer: "Referral credits are automatically applied to your account when your friend completes their first order. The credit will be shown at checkout and applied to your next purchase automatically."
  },
  {
    question: "What dietary restrictions can you accommodate?",
    answer: "We can accommodate most dietary restrictions including gluten-free, dairy-free, and nut allergies. Update your dietary preferences in your Profile settings, and we'll flag items that may not be suitable for you."
  },
  {
    question: "How do I save my payment information?",
    answer: "Payment processing is handled directly through our EPOS terminal at the point of service for maximum security and convenience."
  },
  {
    question: "What's your refund policy?",
    answer: "If you're not satisfied with your order, contact us within 24 hours and we'll make it right. We offer full refunds for quality issues or order errors. Your satisfaction is our top priority!"
  }
  ];
}

export default function SupportPage() {
  const { status } = useSession();
  const router = useRouter();
  const faqItems = getFaqItems();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const response = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          orderId: orderId || undefined,
          message
        })
      });

      if (response.ok) {
        setSubmitMessage({
          type: "success",
          text: "Support ticket submitted successfully! We'll get back to you soon."
        });
        setSubject("");
        setOrderId("");
        setMessage("");
        setTimeout(() => setSubmitMessage(null), 5000);
      } else {
        const data = await response.json();
        setSubmitMessage({
          type: "error",
          text: data.error || "Failed to submit ticket"
        });
      }
    } catch (error) {
      setSubmitMessage({
        type: "error",
        text: "An error occurred"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  if (status === "loading") {
    return (
      <>
        <DashboardHeader />
        <div className="dashboard-container">
          <DashboardSidebar />
          <main className="dashboard-main">
            <p style={{ color: "var(--warm-gray)" }}>Loading...</p>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader />
      <div className="dashboard-container">
        <DashboardSidebar />
        <main id="main-content" className="dashboard-main">
          <section className="dashboard-section">
            <h1>Support & Help</h1>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem" }}>
              Get answers to common questions or contact our support team
            </p>
          </section>

          {/* Quick Contact Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            <article className="panel">
              <h3>📞 Phone Support</h3>
              <p style={{ color: "var(--warm-gray)", marginTop: "0.8rem" }}>
                Call us for immediate assistance
              </p>
              <a
                href={`tel:${businessInfo.phone}`}
                className="btn btn-primary"
                style={{ marginTop: "1rem", width: "100%" }}
              >
                {businessInfo.phone}
              </a>
            </article>

            <article className="panel">
              <h3>✉️ Email Support</h3>
              <p style={{ color: "var(--warm-gray)", marginTop: "0.8rem" }}>
                Send us a message anytime
              </p>
              <a
                href={`mailto:${businessInfo.email}`}
                className="btn btn-secondary"
                style={{ marginTop: "1rem", width: "100%" }}
              >
                {businessInfo.email}
              </a>
            </article>

            <article className="panel">
              <h3>{featureFlags.isDineInEnabled ? '🏪 Visit Us' : '🚚 Service Area'}</h3>
              <p style={{ color: "var(--warm-gray)", marginTop: "0.8rem" }}>
                {businessInfo.location}
              </p>
              <p style={{ color: "var(--warm-gray)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                {featureFlags.isDineInEnabled ? businessInfo.hours : businessInfo.truckSchedule}
              </p>
              {!featureFlags.isDineInEnabled && (
                <p style={{ color: "var(--warm-gray)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                  {businessInfo.cateringAvailability}
                </p>
              )}
            </article>
          </div>

          {/* FAQ Section */}
          <article className="panel" style={{ marginBottom: "2rem" }}>
            <h3>Frequently Asked Questions</h3>
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {faqItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid var(--line-soft)",
                    borderRadius: "8px",
                    overflow: "hidden"
                  }}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    style={{
                      width: "100%",
                      padding: "1rem 1.25rem",
                      background: openFaq === index ? "rgba(217, 109, 49, 0.1)" : "transparent",
                      border: "none",
                      color: "var(--cream)",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "1rem",
                      fontWeight: 500,
                      transition: "all 0.2s"
                    }}
                  >
                    <span>{item.question}</span>
                    <span style={{
                      fontSize: "1.25rem",
                      color: "var(--ember)",
                      transition: "transform 0.2s",
                      transform: openFaq === index ? "rotate(180deg)" : "rotate(0deg)"
                    }}>
                      ▼
                    </span>
                  </button>
                  {openFaq === index && (
                    <div style={{
                      padding: "1rem 1.25rem",
                      borderTop: "1px solid var(--line-soft)",
                      background: "rgba(3, 8, 11, 0.4)"
                    }}>
                      <p style={{ color: "var(--warm-gray)", lineHeight: 1.6, margin: 0 }}>
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>

          {/* Contact Form */}
          <article className="panel">
            <h3>Submit a Support Ticket</h3>
            <p style={{ color: "var(--warm-gray)", marginTop: "0.5rem", marginBottom: "1.5rem" }}>
              Need help with something specific? Fill out the form below and we'll get back to you within 24 hours.
            </p>

            <form onSubmit={handleSubmit} className="form-stack">
              <label>
                Subject <span style={{ color: "var(--ember)" }}>*</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  required
                />
              </label>

              <label>
                Order ID (optional)
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g., clxxxxxx... (if your question is about a specific order)"
                />
              </label>

              <label>
                Message <span style={{ color: "var(--ember)" }}>*</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question in detail..."
                  required
                  rows={6}
                  style={{
                    resize: "vertical",
                    minHeight: "120px"
                  }}
                />
              </label>

              {submitMessage && (
                <p
                  className={submitMessage.type === "success" ? "success-text" : "error-text"}
                  style={{
                    padding: "0.75rem 1rem",
                    background: submitMessage.type === "success" 
                      ? "rgba(34, 197, 94, 0.1)" 
                      : "rgba(239, 68, 68, 0.1)",
                    borderRadius: "8px",
                    border: `1px solid ${submitMessage.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                  }}
                >
                  {submitMessage.text}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ maxWidth: "300px" }}
              >
                {submitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </form>
          </article>
        </main>
      </div>
    </>
  );
}
