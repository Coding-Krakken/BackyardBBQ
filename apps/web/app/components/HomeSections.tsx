"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRef, useState, useEffect } from "react";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  businessInfo,
  cateringHighlights,
  featureHighlights,
  featureFlags,
  galleryImages,
  heroContent,
  menuItems,
  orderingLinks,
  socialLinks,
  testimonials,
  whyUsContent
} from "../config/content";
import { siteImages } from "../config/images";
import { AnalyticsEvents, trackEvent } from "../lib/analytics";

import { 
  fadeInUp, 
  staggerContainer, 
  staggerItem,
  hoverTap,
  durations,
  easings 
} from "../lib/animations";
import { MagneticButton } from "./MagneticButton";
import { EmberParticles } from "./EmberParticles";
import { useCart } from "./cart/CartContext";

function ExternalLinkCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  const isExternal = /^https?:\/\//.test(href);

  if (isExternal) {
    return (
      <motion.a
        className="ordering-card"
        href={href}
        target="_blank"
        rel="noreferrer"
        {...hoverTap.liftCard}
      >
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </motion.a>
    );
  }

  return (
    <motion.div {...hoverTap.liftCard}>
      <Link className="ordering-card" href={href}>
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </Link>
    </motion.div>
  );
}

function SmartLink({
  href,
  className,
  children,
  onClick
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const isExternal = /^https?:\/\//.test(href);
  
  // Check if it's a button (for special animations)
  const isButton = className?.includes("btn");
  const isPrimaryButton = className?.includes("btn-primary");

  if (isExternal) {
    if (isButton) {
      // Primary buttons get magnetic effect
      if (isPrimaryButton) {
        return (
          <MagneticButton as="a" href={href} target="_blank" rel="noreferrer" strength={0.25}>
            <motion.a
              className={className}
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={onClick}
              {...hoverTap.liftButton}
            >
              {children}
            </motion.a>
          </MagneticButton>
        );
      }
      return (
        <motion.a
          className={className}
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={onClick}
          {...hoverTap.liftButton}
        >
          {children}
        </motion.a>
      );
    }
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer" onClick={onClick}>
        {children}
      </a>
    );
  }

  if (isButton) {
    // Primary buttons get magnetic effect
    if (isPrimaryButton) {
      return (
        <MagneticButton strength={0.25}>
          <motion.div {...hoverTap.liftButton}>
            <Link className={className} href={href} onClick={onClick}>
              {children}
            </Link>
          </motion.div>
        </MagneticButton>
      );
    }
    return (
      <motion.div {...hoverTap.liftButton}>
        <Link className={className} href={href} onClick={onClick}>
          {children}
        </Link>
      </motion.div>
    );
  }

  return (
    <Link className={className} href={href} onClick={onClick}>
      {children}
    </Link>
  );
}

export function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);

  // Disable particles on mobile and reduced motion
  const [disableParticles, setDisableParticles] = useState(true);
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setDisableParticles(isMobile || prefersReducedMotion);
  }, []);

  return (
    <motion.section
      className="hero-stage"
      aria-label="Hero"
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <motion.div style={{ y, width: '100%', height: '100%', position: 'absolute' }}>
        <Image
          src={siteImages.hero.src}
          alt={siteImages.hero.alt}
          fill
          priority
          sizes="100vw"
          className="hero-bg"
        />
      </motion.div>
      <div className="hero-overlay" />
      
      {/* Ember particles - subtle atmospheric effect */}
      <EmberParticles density={25} speed={0.5} disabled={disableParticles} />
      
      <motion.div
        className="page-shell hero-content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: durations.verySlow, 
          delay: 0.3,
          ease: easings.easeOut 
        }}
      >
        <motion.span
          className="hero-eyebrow"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: durations.slow }}
        >
          {heroContent.eyebrow}
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: durations.slow }}
        >
          {heroContent.headline}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: durations.slow }}
        >
          {heroContent.description}
        </motion.p>
        <motion.div
          className="cta-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: durations.slow }}
        >
          <SmartLink
            className="btn btn-primary"
            href={heroContent.primaryCta.href}
            onClick={() => trackEvent("cta_clicked_order_online", { source: "home_hero" })}
          >
            {heroContent.primaryCta.label}
          </SmartLink>
          <SmartLink
            className="btn btn-secondary"
            href={heroContent.secondaryCta.href}
            onClick={() => trackEvent("cta_clicked_book_catering", { source: "home_hero" })}
          >
            {heroContent.secondaryCta.label}
          </SmartLink>
          {heroContent.tertiaryCta ? (
            <SmartLink
              className="btn btn-secondary"
              href={heroContent.tertiaryCta.href}
              onClick={() => trackEvent("cta_clicked_reserve_table", { source: "home_hero" })}
            >
              {heroContent.tertiaryCta.label}
            </SmartLink>
          ) : null}
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

export function StorySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      id="story"
      className="page-shell section story-grid"
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <div className="story-image-shell">
        <Image src={siteImages.story.src} alt={siteImages.story.alt} fill sizes="(max-width: 980px) 100vw, 45vw" priority />
        <motion.div
          className="story-image-badges"
          aria-hidden="true"
          initial={{ opacity: 0, x: -30 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          transition={{ delay: 0.3, duration: durations.slow }}
        >
          <article>
            <strong>High Quality</strong>
            <span>Premium ingredients and careful pit standards.</span>
          </article>
          <article>
            <strong>Top Chef</strong>
            <span>Pitmasters obsessed with smoke balance and texture.</span>
          </article>
          <article>
            <strong>Best Meat</strong>
            <span>Locally sourced cuts smoked low and slow.</span>
          </article>
        </motion.div>
      </div>
      <motion.article
        className="panel story-copy"
        initial={{ opacity: 0, x: 30 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
        transition={{ delay: 0.2, duration: durations.slow }}
      >
        <span className="eyebrow">About</span>
        <h2>We Serve Tasty Grilled Goodness</h2>
        <p>
          We run the pit with old-school patience and execute service with modern precision, from weekday lunch
          rushes to large-format catering events.
        </p>
        <ul>
          {featureHighlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
        <div className="cta-row">
          <SmartLink className="btn btn-primary" href="/catering">
            Learn More
          </SmartLink>
        </div>
      </motion.article>
    </motion.section>
  );
}

export function QuickInfoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      className="page-shell section"
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <article className="info-bar" aria-label="Business information">
        <div className="info-primary-grid">
          <motion.div
            className="info-item"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.1, duration: durations.slow }}
          >
            <span className="info-index">01</span>
            <h4>Location</h4>
            <p>{businessInfo.location}</p>
          </motion.div>
          <motion.div
            className="info-item"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.2, duration: durations.slow }}
          >
            <span className="info-index">02</span>
            <h4>Phone</h4>
            <p>{businessInfo.phone}</p>
          </motion.div>
          <motion.div
            className="info-item"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.3, duration: durations.slow }}
          >
            <span className="info-index">03</span>
            <h4>Email</h4>
            <p>{businessInfo.email}</p>
          </motion.div>
          <motion.div
            className="info-item"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.4, duration: durations.slow }}
          >
            <span className="info-index">04</span>
            <h4>Working Hours</h4>
            <p>{businessInfo.hours}</p>
          </motion.div>
        </div>
      </article>
    </motion.section>
  );
}

interface FeaturedMenuItem {
  id: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  imageUrl: string | null;
}

function isRemoteImageSource(src: string) {
  return /^https?:\/\//.test(src);
}

export function FeaturedMenuSection({ items }: { items: FeaturedMenuItem[] }) {
  const { dispatch } = useCart();
  const featuredItems = items.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description || '',
    basePriceCents: item.basePriceCents,
    price: `$${(item.basePriceCents / 100).toFixed(2)}`,
    image: {
      src: item.imageUrl || '/images/placeholder-food.jpg',
      alt: item.name
    }
  }));
  
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [selectedItem, setSelectedItem] = useState<null | { id: string; name: string; description: string; price: string; basePriceCents: number; image: { src: string; alt: string } }>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!selectedItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedItem(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem]);

  const addFeaturedItemToCart = (item: { id: string; name: string; image: { src: string; alt: string }; basePriceCents: number }) => {
    dispatch({
      type: "ADD_ITEM",
      payload: {
        menuItemId: item.id,
        name: item.name,
        imageUrl: item.image.src,
        unitPriceCents: item.basePriceCents,
        quantity: 1,
        customizations: [],
        notes: ""
      }
    });

    trackEvent(AnalyticsEvents.menuItemAddedToCart, {
      itemId: item.id,
      itemName: item.name,
      source: "homepage_featured"
    });
  };

  // Focus trap and restore focus
  useEffect(() => {
    if (selectedItem) {
      lastFocusedRef.current = document.activeElement as HTMLElement;
      // Focus the modal after animation
      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
    } else if (lastFocusedRef.current) {
      lastFocusedRef.current.focus();
      lastFocusedRef.current = null;
    }
  }, [selectedItem]);

  return (
    <motion.section
      id="menu"
      className="page-shell section"
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <div className="section-heading menu-heading-grid">
        <div>
          <span className="eyebrow">Featured Menu</span>
          <h2>Our Best Selling BBQ Dishes</h2>
        </div>
        <div className="menu-heading-meta">
          <p>
            Explore signature brisket, ribs, smoked sides, and crowd-favorite classics prepared with championship pit
            technique.
          </p>
          <SmartLink className="btn btn-secondary" href="/menu">
            View Full Menu
          </SmartLink>
        </div>
      </div>
      <motion.div
        className="menu-grid"
        variants={staggerContainer}
        initial="initial"
        animate={isInView ? "animate" : "initial"}
      >
        {featuredItems.map((item, index) => (
          <motion.article
            className="menu-card"
            key={item.name}
            layoutId={`menu-item-${item.name}`}
            variants={staggerItem}
            role="button"
            tabIndex={0}
            aria-label={`View details for ${item.name}`}
            onClick={() => setSelectedItem(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedItem(item);
              }
            }}
            style={{ cursor: "pointer" }}
            whileHover={{ 
              y: -8,
              scale: 1.02,
              transition: { type: "spring", stiffness: 300, damping: 20 }
            }}
          >
            <div className="menu-image-shell">
              <Image
                src={item.image.src}
                alt={item.image.alt}
                fill
                sizes="(max-width: 980px) 100vw, 33vw"
                unoptimized={isRemoteImageSource(item.image.src)}
              />
            </div>
            <div className="menu-card-copy">
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <strong>{item.price}</strong>
            </div>
          </motion.article>
        ))}
      </motion.div>

      {/* Shared Element Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.8)",
                zIndex: 999,
                cursor: "pointer"
              }}
            />
            {/* Modal Content with Shared Layout */}
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedItem.name} details`}
              tabIndex={-1}
              onKeyDown={(e) => {
                // Focus trap: cycle focus within modal
                if (e.key === "Tab") {
                  const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                  );
                  if (focusable && focusable.length > 0) {
                    const first = focusable[0]!;
                    const last = focusable[focusable.length - 1]!;
                    if (e.shiftKey && document.activeElement === first) {
                      e.preventDefault();
                      last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                      e.preventDefault();
                      first.focus();
                    }
                  }
                }
              }}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                pointerEvents: "none",
                padding: "2rem"
              }}
            >
              <motion.article
                layoutId={`menu-item-${selectedItem.name}`}
                style={{
                  background: "var(--bg-soft)",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  overflow: "hidden",
                  maxWidth: "600px",
                  width: "100%",
                  pointerEvents: "auto",
                  cursor: "default"
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ position: "relative", height: "300px", width: "100%" }}>
                  <Image
                    src={selectedItem.image.src}
                    alt={selectedItem.image.alt}
                    fill
                    sizes="600px"
                    unoptimized={isRemoteImageSource(selectedItem.image.src)}
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{ padding: "2rem" }}
                >
                  <h2 style={{ marginTop: 0, marginBottom: "1rem", color: "var(--cream)" }}>
                    {selectedItem.name}
                  </h2>
                  <p style={{ color: "var(--warm-gray)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                    {selectedItem.description}
                  </p>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: "1.5rem"
                  }}>
                    <strong style={{ fontSize: "1.5rem", color: "var(--ember)" }}>
                      {selectedItem.price}
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <div style={{ flex: 1 }}>
                      <SmartLink 
                        className="btn btn-primary" 
                        href="/menu"
                      >
                        View on Menu
                      </SmartLink>
                    </div>
                    <button
                      onClick={() => addFeaturedItemToCart(selectedItem)}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Add to Cart
                    </button>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.article>
            </div>
          </>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export function CinematicBreakSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  const y = useTransform(scrollYProgress, [0, 1], [-50, 50]);

  return (
    <motion.section
      className="image-break"
      aria-label="Cinematic barbecue image"
      ref={ref}
      initial={{ opacity: 0, scale: 1.1 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.1 }}
      transition={{ duration: durations.verySlow, ease: easings.smooth }}
    >
      <motion.div style={{ y, width: '100%', height: '100%', position: 'absolute' }}>
        <Image src={siteImages.imageBreak.src} alt={siteImages.imageBreak.alt} fill sizes="100vw" />
      </motion.div>
      <div className="image-break-overlay" />
    </motion.section>
  );
}

export function TestimonialsSection() {
  const featured = testimonials[0];
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      className="page-shell section"
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <article className="testimonial-featured">
        <motion.span
          className="quote-mark"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          \"
        </motion.span>
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.3, duration: durations.slow }}
        >
          "{featured.quote}"
        </motion.p>
        <motion.h4
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: 0.5, duration: durations.slow }}
        >
          {featured.name}
        </motion.h4>
        <motion.span
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6, duration: durations.slow }}
        >
          {featured.role}
        </motion.span>
      </article>
    </motion.section>
  );
}

export function CateringSalesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      id="catering"
      className="page-shell section story-grid"
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <div className="story-image-shell tall">
        <Image
          src={siteImages.catering.src}
          alt={siteImages.catering.alt}
          fill
          sizes="(max-width: 980px) 100vw, 45vw"
        />
      </div>
      <motion.article
        className="panel story-copy"
        initial={{ opacity: 0, x: 30 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
        transition={{ delay: 0.2, duration: durations.slow }}
      >
        <span className="eyebrow">Catering</span>
        <h2>Luxury BBQ Catering for Weddings, Corporate, and Private Events</h2>
        <p>
          Bring the full Backyard BBQ King experience to your venue with premium tray presentation, event-ready
          staffing, and streamlined logistics from quote to service.
        </p>
        <ul>
          {cateringHighlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
        <div className="cta-row">
          <SmartLink className="btn btn-primary" href={orderingLinks.cateringInquiryUrl}>
            Start Catering Inquiry
          </SmartLink>
          <SmartLink className="btn btn-secondary" href="/catering" onClick={() => trackEvent("cta_clicked_book_catering", { source: "home_catering" })}>
            Check Availability
          </SmartLink>
        </div>
      </motion.article>
    </motion.section>
  );
}

export function OrderingHubSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const checkoutSubtitle = "EPOS-powered payment flow";

  return (
    <motion.section
      className="page-shell section"
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <div className="section-heading">
        <span className="eyebrow">Online Ordering</span>
        <h2>Order BBQ Online</h2>
      </div>
      <motion.div
        className="ordering-grid"
        variants={staggerContainer}
        initial="initial"
        animate={isInView ? "animate" : "initial"}
      >
        <motion.div variants={staggerItem}>
          <ExternalLinkCard href={orderingLinks.orderOnlineUrl} title="Order Online" subtitle="Direct pickup and delivery" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <ExternalLinkCard href={orderingLinks.doordashUrl} title="DoorDash" subtitle="Fast delivery with live tracking" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <ExternalLinkCard href={orderingLinks.uberEatsUrl} title="Uber Eats" subtitle="Reliable neighborhood delivery" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <ExternalLinkCard href={orderingLinks.grubhubUrl} title="Grubhub" subtitle="Expanded local delivery coverage" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <ExternalLinkCard href="/checkout" title="Secure Checkout" subtitle={checkoutSubtitle} />
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

export function HowItWorksSection() {
  const baseSteps = [
    {
      title: "Order Pickup or Delivery",
      description: "Build your cart, choose pickup or delivery, and checkout in minutes."
    },
    {
      title: "Book Catering",
      description: "Submit your event details and package preferences for a fast quote workflow."
    },
    {
      title: "Reserve A Table",
      description: "Pick date, time, and party size with instant reservation request confirmation."
    }
  ] as const;

  const steps = baseSteps.filter(step => 
    step.title !== "Reserve A Table" || featureFlags.isDineInEnabled
  );

  return (
    <section className="page-shell section">
      <div className="section-heading center">
        <span className="eyebrow">How It Works</span>
        <h2>{featureFlags.isDineInEnabled ? 'Three Fast Paths to Great BBQ' : 'Two Fast Paths to Great BBQ'}</h2>
      </div>
      <div className="info-primary-grid">
        {steps.map((step, index) => (
          <article className="info-item" key={step.title}>
            <span className="info-index">0{index + 1}</span>
            <h4>{step.title}</h4>
            <p>{step.description}</p>
          </article>
        ))}
      </div>
      <div className="cta-row" style={{ justifyContent: "center" }}>
        <SmartLink className="btn btn-primary" href="/menu" onClick={() => trackEvent(AnalyticsEvents.ctaClickedOrderOnline, { source: "how_it_works" })}>
          Start Ordering
        </SmartLink>
        <SmartLink className="btn btn-secondary" href="/catering" onClick={() => trackEvent(AnalyticsEvents.ctaClickedBookCatering, { source: "how_it_works" })}>
          Get Catering Quote
        </SmartLink>
      </div>
    </section>
  );
}

export function GallerySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      id="gallery"
      className="page-shell section"
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <div className="section-heading">
        <span className="eyebrow">Gallery</span>
        <h2>Smoke, Fire, Flavor, and Event Energy</h2>
      </div>
      <motion.div
        className="gallery-grid"
        variants={staggerContainer}
        initial="initial"
        animate={isInView ? "animate" : "initial"}
      >
        {galleryImages.map((image, index) => (
          <motion.article
            className={`gallery-card gallery-card-${(index % 3) + 1}`}
            key={image.src}
            variants={staggerItem}
            whileHover={{ scale: 1.05, transition: { type: "spring", stiffness: 300 } }}
          >
            <Image src={image.src} alt={image.alt} fill sizes="(max-width: 980px) 100vw, 33vw" />
          </motion.article>
        ))}
      </motion.div>
    </motion.section>
  );
}

export function FinalCtaSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  if (!featureFlags.isDineInEnabled) {
    return null;
  }

  return (
    <motion.section
      className="final-cta"
      aria-label="Final call to action"
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: durations.verySlow }}
    >
      <Image src={siteImages.finalCta.src} alt={siteImages.finalCta.alt} fill sizes="100vw" />
      <div className="final-cta-overlay" />
      <motion.div
        className="page-shell final-cta-content"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ delay: 0.3, duration: durations.verySlow, ease: easings.easeOut }}
      >
        <h2>Reserve Your Table for an Unforgettable BBQ Experience!</h2>
        <p>
          Don&apos;t miss out on the ultimate BBQ experience. Reserve your table today and enjoy mouth-watering, slow
          smoked meats, flavorful sides, and exceptional service.
        </p>
        <div className="cta-row">
          <SmartLink
            className="btn btn-primary"
            href="/reserve"
            onClick={() => trackEvent("cta_clicked_reserve_table", { source: "home_final_cta" })}
          >
            Reserve A Table
          </SmartLink>
          <SmartLink
            className="btn btn-secondary"
            href="/menu"
            onClick={() => trackEvent("cta_clicked_order_online", { source: "home_final_cta" })}
          >
            Order Online
          </SmartLink>
        </div>
      </motion.div>
    </motion.section>
  );
}

export function WhyUsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      className="page-shell section"
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: durations.verySlow, ease: easings.easeOut }}
    >
      <article className="why-us-grid">
        <motion.div
          className="why-us-images"
          initial={{ opacity: 0, x: -30 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          transition={{ delay: 0.2, duration: durations.slow }}
        >
          <div className="why-us-image-shell">
            <Image src={siteImages.whyUsLeft.src} alt={siteImages.whyUsLeft.alt} fill sizes="(max-width: 980px) 100vw, 24vw" />
          </div>
          <div className="why-us-image-shell">
            <Image src={siteImages.whyUsRight.src} alt={siteImages.whyUsRight.alt} fill sizes="(max-width: 980px) 100vw, 24vw" />
          </div>
        </motion.div>
        <motion.div
          className="why-us-copy"
          initial={{ opacity: 0, x: 30 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
          transition={{ delay: 0.3, duration: durations.slow }}
        >
          <span className="eyebrow">{whyUsContent.eyebrow}</span>
          <h2>{whyUsContent.headline}</h2>
          <p>{whyUsContent.description}</p>
          <ul>
            {whyUsContent.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </motion.div>
      </article>
    </motion.section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell footer-grid">
        <div className="footer-branding">
          <div className="site-brand-mark">BBQ</div>
          <h3>Backyard BBQ King</h3>
        </div>
        <div className="footer-nav-links">
          <a href="/">Home</a>
          <a href="/menu">Menu</a>
          <a href="/catering">Catering</a>
          {featureFlags.isDineInEnabled && <a href="/reserve">Reserve A Table</a>}
          <a href="/dashboard">Account</a>
        </div>
        <div className="footer-socials" aria-label="Social media links">
          <SmartLink href={socialLinks.instagram}>Instagram</SmartLink>
          <SmartLink href={socialLinks.facebook}>Facebook</SmartLink>
          <SmartLink href={socialLinks.x}>X</SmartLink>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} Backyard BBQ King. All rights reserved.</div>
    </footer>
  );
}
