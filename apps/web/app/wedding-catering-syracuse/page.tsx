import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "../components/SiteNavbar";
import { SiteFooter } from "../components/HomeSections";
import { FaqSection } from "../components/seo/FaqSection";
import { JsonLd } from "../components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Wedding Catering Syracuse",
  description:
    "Wedding BBQ catering in Syracuse with premium pitmaster packages, polished service, and customizable menus."
};

const faqItems = [
  { question: "Do you handle weddings of 100+ guests?", answer: "Yes. We support high guest counts with package tiers and staffing recommendations." },
  { question: "Can we build a custom wedding menu?", answer: "Yes. We can customize proteins, sides, vegetarian support, and late-night service options." },
  { question: "How does the deposit work?", answer: "Submit your quote request first. Once availability is confirmed, we issue your optional deposit step." }
];

export default function WeddingCateringSyracusePage() {
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
          <span className="eyebrow">Wedding BBQ</span>
          <h1>Wedding Catering in Syracuse</h1>
          <p>
            Serve your guests premium smoked meats and standout sides with a wedding-focused catering flow built for
            polished execution and stress-free planning.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/catering">Get Wedding Catering Quote</Link>
            <Link className="btn btn-secondary" href="/corporate-catering-syracuse">Corporate Catering</Link>
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
