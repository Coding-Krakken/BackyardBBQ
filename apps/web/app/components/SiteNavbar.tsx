"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { orderingLinks } from "../config/content";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/#story", label: "About" },
  { href: "/#menu", label: "Menu" },
  { href: "/#catering", label: "Contact" }
] as const;

const primaryDesktopCta = {
  href: orderingLinks.cateringInquiryUrl,
  label: "Reserve A Table"
} as const;

const ctaLinks = [
  { href: orderingLinks.orderOnlineUrl, label: "Order Online", variant: "primary" },
  { href: orderingLinks.cateringInquiryUrl, label: "Catering", variant: "secondary" },
  { href: orderingLinks.doordashUrl, label: "DoorDash", variant: "ghost" },
  { href: orderingLinks.uberEatsUrl, label: "Uber Eats", variant: "ghost" },
  { href: "/dashboard", label: "Dashboard", variant: "ghost" }
] as const;

function isExternalUrl(url: string) {
  return /^https?:\/\//.test(url);
}

export function SiteNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 14);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const navStateClass = useMemo(() => {
    const classes = [];
    if (mobileOpen) {
      classes.push("is-open");
    }
    if (isScrolled) {
      classes.push("is-scrolled");
    }

    return classes.join(" ");
  }, [isScrolled, mobileOpen]);

  return (
    <header className={`site-nav-shell ${navStateClass}`}>
      <nav className="site-nav page-shell" aria-label="Primary navigation">
        <Link className="site-brand" href="/">
          <span className="site-brand-mark">BBQ</span>
          <span className="site-brand-text">Backyard BBQ King</span>
        </Link>

        <button
          className="mobile-nav-toggle"
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((state) => !state)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="site-nav-links">
          {navLinks.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="site-nav-ctas">
          <Link className="btn nav-btn nav-btn-reserve" href={primaryDesktopCta.href}>
            {primaryDesktopCta.label}
          </Link>
        </div>
      </nav>

      <div className="mobile-nav-drawer" role="dialog" aria-label="Mobile navigation">
        <div className="mobile-nav-links">
          {navLinks.map((item) => (
            <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)}>
              {item.label}
            </a>
          ))}
          <Link href="/catering" onClick={() => setMobileOpen(false)}>
            Catering Page
          </Link>
          <Link href="/checkout" onClick={() => setMobileOpen(false)}>
            Checkout
          </Link>
          <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
            Dashboard
          </Link>
        </div>

        <div className="mobile-nav-ctas">
          {ctaLinks.map((item) => {
            const className = `btn nav-btn nav-btn-${item.variant}`;
            if (isExternalUrl(item.href)) {
              return (
                <a key={item.label} className={className} href={item.href} rel="noreferrer" target="_blank">
                  {item.label}
                </a>
              );
            }

            return (
              <Link key={item.label} className={className} href={item.href} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
