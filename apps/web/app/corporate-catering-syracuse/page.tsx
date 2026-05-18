import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "../components/SiteNavbar";
import { SiteFooter } from "../components/HomeSections";
import { FaqSection } from "../components/seo/FaqSection";
import { JsonLd } from "../components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Corporate Catering Syracuse",
  description:
    "Corporate BBQ catering in Syracuse with reliable scheduling, scalable packages, and delivery or staffed service."
};

const faqItems = [
  { question: "Can you handle recurring office lunches?", answer: "Yes, we support one-time and recurring catering schedules for teams and events." },
  { question: "Do you provide setup and service staff?", answer: "We provide delivery setup by default, and staffing options are available for larger events." },
  { question: "Is there a minimum guest count?", answer: "Most corporate packages start around 20 guests; larger tiers unlock volume pricing." }
];

export default function CorporateCateringSyracusePage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };

  return (
    <main id="main-content">
      <JsonLd data={schema} />
      <SiteNavbar />
      <section className="page-shell section">
        <article className="panel">
          <span className="eyebrow">Corporate Catering</span>
          <h1>Corporate Catering in Syracuse</h1>
          <p>
            Keep your team fed with oak-smoked BBQ that lands hot, on time, and presentation-ready for meetings,
            launches, offsites, and appreciation events.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/catering">Request Corporate Quote</Link>
            <Link className="btn btn-secondary" href="/menu">Order Individual Meals</Link>
          </div>
        </article>
      </section>
      <section className="page-shell section">
        <FaqSection items={faqItems} />
      </section>
      <SiteFooter />
    </main>
  );
}
