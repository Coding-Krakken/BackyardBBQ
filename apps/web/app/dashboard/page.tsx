import Link from "next/link";
import { SiteFooter } from "../components/HomeSections";
import { SiteNavbar } from "../components/SiteNavbar";

const dashboardModules = [
  {
    title: "Active Orders",
    summary: "Track order progress, pickup windows, and delivery milestones in one timeline.",
    cta: "Open Checkout",
    href: "/checkout"
  },
  {
    title: "Catering Bookings",
    summary: "Review upcoming events, guest counts, and payment milestones for each booking.",
    cta: "Check Availability",
    href: "/catering"
  },
  {
    title: "Receipts and Invoices",
    summary: "Access transaction history and invoice-ready records for business reimbursement.",
    cta: "Start New Order",
    href: "/"
  }
] as const;

export default function CustomerDashboardPage() {
  return (
    <main id="main-content">
      <SiteNavbar />
      <section className="page-shell section reveal dashboard-header-space">
        <article className="panel dashboard-hero">
          <span className="eyebrow">Customer Command Center</span>
          <h1>Track Orders, Catering Events, and Payment Records</h1>
          <p>
            A premium dashboard surface for returning guests to manage smokehouse orders and event service in one
            place.
          </p>
        </article>
      </section>

      <section className="page-shell section reveal">
        <div className="dashboard-grid">
          {dashboardModules.map((module) => (
            <article className="panel dashboard-card" key={module.title}>
              <h3>{module.title}</h3>
              <p>{module.summary}</p>
              <Link className="btn btn-secondary" href={module.href}>
                {module.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
