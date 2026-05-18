import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "../components/SiteNavbar";
import { SiteFooter } from "../components/HomeSections";
import { FaqSection } from "../components/seo/FaqSection";
import { JsonLd } from "../components/seo/JsonLd";

export const metadata: Metadata = {
  title: "BBQ Catering Syracuse NY",
  description:
    "Book premium BBQ catering in Syracuse, NY with smoked meats, loaded sides, and full-service event execution."
};

const faqItems = [
  { question: "How far in advance should I book?", answer: "For prime dates, we recommend 2-6 weeks. We can accommodate rush bookings based on availability." },
  { question: "Do you deliver and set up?", answer: "Yes. We offer delivery, setup, and service options depending on event size and package tier." },
  { question: "Can I customize the menu?", answer: "Absolutely. We can tailor proteins, sides, portions, and service style to your event goals." }
];

export default function BbqCateringSyracusePage() {
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://backyard-bbq.vercel.app/" },
        { "@type": "ListItem", position: 2, name: "BBQ Catering Syracuse NY", item: "https://backyard-bbq.vercel.app/bbq-catering-syracuse-ny" }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    }
  ];

  return (
    <main id="main-content">
      <JsonLd data={schema} />
      <SiteNavbar />
      <section className="page-shell section">
        <article className="panel">
          <span className="eyebrow">Syracuse Catering</span>
          <h1>BBQ Catering in Syracuse, NY</h1>
          <p>
            Backyard BBQ King delivers slow-smoked brisket, fall-off-the-bone ribs, oak-fired pulled pork, and loaded
            sides for weddings, private parties, and business events across Syracuse.
          </p>
          <p>
            From guest-count planning to day-of setup, our catering flow is built for reliable execution and memorable
            food experiences.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/catering">Get Catering Quote</Link>
            <Link className="btn btn-secondary" href="/menu">View Menu</Link>
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
