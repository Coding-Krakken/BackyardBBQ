import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "../components/SiteNavbar";
import { SiteFooter } from "../components/HomeSections";
import { FaqSection } from "../components/seo/FaqSection";
import { JsonLd } from "../components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Food Truck Syracuse NY",
  description:
    "Hire Backyard BBQ King's food truck in Syracuse, NY for festivals, private events, and high-volume service."
};

const faqItems = [
  { question: "What events do you serve?", answer: "Corporate activations, school events, neighborhood festivals, weddings, and private parties." },
  { question: "How many guests can you serve?", answer: "Our food truck packages support both small gatherings and large event windows with staged service." },
  { question: "Do you need power or utilities on site?", answer: "We provide setup requirements during booking and can operate self-contained for many event formats." }
];

export default function FoodTruckSyracusePage() {
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://backyard-bbq.vercel.app/" },
        { "@type": "ListItem", position: 2, name: "Food Truck Syracuse NY", item: "https://backyard-bbq.vercel.app/food-truck-syracuse-ny" }
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
          <span className="eyebrow">Food Truck Service</span>
          <h1>BBQ Food Truck in Syracuse, NY</h1>
          <p>
            Bring a live smokehouse experience to your event with a polished food truck flow, fast ticket times, and
            crowd-favorite BBQ built for high-throughput service.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/catering">Book Food Truck Event</Link>
            <Link className="btn btn-secondary" href="/bbq-catering-syracuse-ny">Explore Catering</Link>
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
