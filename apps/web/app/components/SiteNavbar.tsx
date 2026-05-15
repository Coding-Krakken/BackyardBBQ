"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => {
        window.removeEventListener('keydown', handleEscape);
      };
    }
  }, [mobileOpen]);

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

  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";

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
            aria-controls="mobile-nav-drawer"
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
              <motion.span
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <Link href={authLink.href}>
                  {authLink.label}
                </Link>
              </motion.span>
            )}
            {isAdmin && (
              <motion.span
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <Link href={process.env.NEXT_PUBLIC_ADMIN_URL ?? "/admin"} style={{ color: "var(--ember, #e05c1a)", fontWeight: 600 }}>
                  Admin
                </Link>
              </motion.span>
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

      {/* Portal: renders outside the header to avoid backdrop-filter containing-block bug */}
      {mounted && createPortal(
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="mobile-nav-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0, 0, 0, 0.55)",
                  backdropFilter: "blur(3px)",
                  WebkitBackdropFilter: "blur(3px)",
                  zIndex: 998,
                }}
              />
              <motion.div
                id="mobile-nav-drawer"
                className="mobile-nav-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={springs.layout}
                style={{ zIndex: 999 }}
              >
                <button
                  className="mobile-nav-close"
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setMobileOpen(false)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                <div className="mobile-nav-links">
                  {navLinks.map((item) => (
                    <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)}>
                      {item.label}
                    </a>
                  ))}
                  {authLink && (
                    <Link href={authLink.href} onClick={() => setMobileOpen(false)}>
                      {authLink.label}
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href={process.env.NEXT_PUBLIC_ADMIN_URL ?? "/admin"} onClick={() => setMobileOpen(false)} style={{ color: "var(--ember, #e05c1a)", fontWeight: 600 }}>
                      Admin
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
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
