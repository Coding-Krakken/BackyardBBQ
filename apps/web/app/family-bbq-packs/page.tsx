import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "../components/SiteNavbar";
import { SiteFooter } from "../components/HomeSections";
import { JsonLd } from "../components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Family BBQ Packs",
  description:
    "Family BBQ packs with smoked meats, loaded sides, and crowd-friendly portions for pickup or delivery."
};

const packs = [
  {
    name: "Backyard Family Pack",
    serves: "Serves 4-6",
    startingPrice: "$79",
    description: "Choice of two smoked meats, three loaded sides, and house sauce trio."
  },
  {
    name: "Weekend Smokehouse Pack",
    serves: "Serves 8-10",
    startingPrice: "$149",
    description: "Brisket, ribs, pulled pork, mac tray, pit beans, slaw, cornbread, and pickles."
  },
  {
    name: "Game Day Pit Pack",
    serves: "Serves 12+",
    startingPrice: "$219",
    description: "Built for parties with wings, burnt ends, sandwich buns, and stacked side pans."
  }
];

export default function FamilyBbqPacksPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: packs.map((pack, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: pack.name,
        description: pack.description,
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          price: pack.startingPrice.replace("$", ""),
          availability: "https://schema.org/InStock"
        }
      }
    }))
  };

  return (
    <main id="main-content">
      <JsonLd data={schema} />
      <SiteNavbar />
      <section className="page-shell section">
        <article className="panel">
          <span className="eyebrow">Family Meals</span>
          <h1>Family BBQ Packs</h1>
          <p>
            Feed your crew with smoker-fresh family packs built for weeknights, birthdays, and game-day gatherings.
          </p>
        </article>
      </section>

      <section className="page-shell section">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          {packs.map((pack) => (
            <article className="panel" key={pack.name}>
              <h2>{pack.name}</h2>
              <p><strong>{pack.serves}</strong> · Starting at {pack.startingPrice}</p>
              <p>{pack.description}</p>
              <div className="cta-row">
                <Link className="btn btn-primary" href="/menu">Order Online</Link>
                <Link className="btn btn-secondary" href="/catering">Need More Guests?</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
