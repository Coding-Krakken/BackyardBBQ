"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { orderingLinks } from "../config/content";
import { MagneticButton } from "./MagneticButton";
import { springs } from "../lib/animations";

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
  { href: orderingLinks.uberEatsUrl, label: "Uber Eats", variant: "ghost" }
] as const;

function isExternalUrl(url: string) {
  return /^https?:\/\//.test(url);
}

export function SiteNavbar() {
  const { data: session, status } = useSession();
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

  const authLink = useMemo(() => {
    if (status === "loading") {
      return null;
    }
    if (session) {
      return { href: "/dashboard", label: "Dashboard" };
    }
    return { href: "/auth/login", label: "Sign In" };
  }, [session, status]);

  return (
    <>
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
            <motion.a
              key={item.label}
              href={item.href}
              className="nav-link"
              whileHover="hover"
              whileTap={{ scale: 0.95 }}
              initial="idle"
              style={{ position: "relative", display: "inline-block" }}
            >
              <motion.span
                variants={{
                  idle: { y: 0 },
                  hover: { y: -2 },
                }}
              >
                {item.label}
              </motion.span>
              <motion.span
                className="nav-link-underline"
                variants={{
                  idle: { scaleX: 0 },
                  hover: { scaleX: 1 },
                }}
                transition={springs.gentle}
                style={{
                  position: "absolute",
                  bottom: -4,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "var(--ember)",
                  borderRadius: 2,
                  transformOrigin: "left",
                }}
              />
            </motion.a>
          ))}
          {authLink && (
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link href={authLink.href}>
                {authLink.label}
              </Link>
            </motion.div>
          )}
        </div>

        <div className="site-nav-ctas">
          <MagneticButton strength={0.25}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link className="btn nav-btn nav-btn-reserve" href={primaryDesktopCta.href}>
                {primaryDesktopCta.label}
              </Link>
            </motion.div>
          </MagneticButton>
        </div>
      </nav>
    </header>

    <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              className="mobile-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setMobileOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                zIndex: 98,
              }}
            />
            <motion.div
              className="mobile-nav-drawer"
              role="dialog"
              aria-label="Mobile navigation"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={springs.layout}
            >
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
              {authLink && (
                <Link href={authLink.href} onClick={() => setMobileOpen(false)}>
                  {authLink.label}
                </Link>
              )}
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
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
