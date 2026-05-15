import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  businessInfo,
  cateringHighlights,
  featureHighlights,
  galleryImages,
  heroContent,
  menuItems,
  orderingLinks,
  socialLinks,
  testimonials,
  whyUsContent
} from "../config/content";
import { siteImages } from "../config/images";

function ExternalLinkCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  const isExternal = /^https?:\/\//.test(href);

  if (isExternal) {
    return (
      <a className="ordering-card" href={href} target="_blank" rel="noreferrer">
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </a>
    );
  }

  return (
    <Link className="ordering-card" href={href}>
      <h4>{title}</h4>
      <p>{subtitle}</p>
    </Link>
  );
}

function SmartLink({
  href,
  className,
  children
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const isExternal = /^https?:\/\//.test(href);

  if (isExternal) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

export function HeroSection() {
  return (
    <section className="hero-stage reveal" aria-label="Hero">
      <Image
        src={siteImages.hero.src}
        alt={siteImages.hero.alt}
        fill
        priority
        sizes="100vw"
        className="hero-bg"
      />
      <div className="hero-overlay" />
      <div className="page-shell hero-content">
        <span className="hero-eyebrow">{heroContent.eyebrow}</span>
        <h1>{heroContent.headline}</h1>
        <p>{heroContent.description}</p>
        <div className="cta-row">
          <SmartLink className="btn btn-primary" href={heroContent.primaryCta.href}>
            {heroContent.primaryCta.label}
          </SmartLink>
          <SmartLink className="btn btn-secondary" href={heroContent.secondaryCta.href}>
            {heroContent.secondaryCta.label}
          </SmartLink>
        </div>
      </div>
    </section>
  );
}

export function StorySection() {
  return (
    <section id="story" className="page-shell section story-grid reveal">
      <div className="story-image-shell">
        <Image src={siteImages.story.src} alt={siteImages.story.alt} fill sizes="(max-width: 980px) 100vw, 45vw" />
        <div className="story-image-badges" aria-hidden="true">
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
        </div>
      </div>
      <article className="panel story-copy">
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
          <Link className="btn btn-primary" href="/catering">
            Learn More
          </Link>
        </div>
      </article>
    </section>
  );
}

export function QuickInfoSection() {
  return (
    <section className="page-shell section reveal">
      <article className="info-bar" aria-label="Business information">
        <div className="info-primary-grid">
          <div className="info-item">
            <span className="info-index">01</span>
            <h4>Location</h4>
            <p>{businessInfo.location}</p>
          </div>
          <div className="info-item">
            <span className="info-index">02</span>
            <h4>Phone</h4>
            <p>{businessInfo.phone}</p>
          </div>
          <div className="info-item">
            <span className="info-index">03</span>
            <h4>Email</h4>
            <p>{businessInfo.email}</p>
          </div>
          <div className="info-item">
            <span className="info-index">04</span>
            <h4>Working Hours</h4>
            <p>{businessInfo.hours}</p>
          </div>
        </div>
      </article>
    </section>
  );
}

export function FeaturedMenuSection() {
  const featuredItems = menuItems.slice(0, 4);

  return (
    <section id="menu" className="page-shell section reveal">
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
          <Link className="btn btn-secondary" href="/checkout">
            View Menu
          </Link>
        </div>
      </div>
      <div className="menu-grid">
        {featuredItems.map((item) => (
          <article className="menu-card" key={item.name}>
            <div className="menu-image-shell">
              <Image src={item.image.src} alt={item.image.alt} fill sizes="(max-width: 980px) 100vw, 33vw" />
            </div>
            <div className="menu-card-copy">
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <strong>{item.price}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CinematicBreakSection() {
  return (
    <section className="image-break reveal" aria-label="Cinematic barbecue image">
      <Image src={siteImages.imageBreak.src} alt={siteImages.imageBreak.alt} fill sizes="100vw" />
      <div className="image-break-overlay" />
    </section>
  );
}

export function TestimonialsSection() {
  const featured = testimonials[0];

  return (
    <section className="page-shell section reveal">
      <article className="testimonial-featured">
        <span className="quote-mark">\"</span>
        <p>"{featured.quote}"</p>
        <h4>{featured.name}</h4>
        <span>{featured.role}</span>
      </article>
    </section>
  );
}

export function CateringSalesSection() {
  return (
    <section id="catering" className="page-shell section story-grid reveal">
      <div className="story-image-shell tall">
        <Image
          src={siteImages.catering.src}
          alt={siteImages.catering.alt}
          fill
          sizes="(max-width: 980px) 100vw, 45vw"
        />
      </div>
      <article className="panel story-copy">
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
          <Link className="btn btn-secondary" href="/catering">
            Check Availability
          </Link>
        </div>
      </article>
    </section>
  );
}

export function OrderingHubSection() {
  return (
    <section className="page-shell section reveal">
      <div className="section-heading">
        <span className="eyebrow">Online Ordering</span>
        <h2>Order BBQ Online</h2>
      </div>
      <div className="ordering-grid">
        <ExternalLinkCard href={orderingLinks.orderOnlineUrl} title="Order Online" subtitle="Direct pickup and delivery" />
        <ExternalLinkCard href={orderingLinks.doordashUrl} title="DoorDash" subtitle="Fast delivery with live tracking" />
        <ExternalLinkCard href={orderingLinks.uberEatsUrl} title="Uber Eats" subtitle="Reliable neighborhood delivery" />
        <ExternalLinkCard href={orderingLinks.grubhubUrl} title="Grubhub" subtitle="Expanded local delivery coverage" />
        <ExternalLinkCard href="/checkout" title="Secure Checkout" subtitle="Stripe-powered payment flow" />
      </div>
    </section>
  );
}

export function GallerySection() {
  return (
    <section id="gallery" className="page-shell section reveal">
      <div className="section-heading">
        <span className="eyebrow">Gallery</span>
        <h2>Smoke, Fire, Flavor, and Event Energy</h2>
      </div>
      <div className="gallery-grid">
        {galleryImages.map((image, index) => (
          <article className={`gallery-card gallery-card-${(index % 3) + 1}`} key={image.src}>
            <Image src={image.src} alt={image.alt} fill sizes="(max-width: 980px) 100vw, 33vw" />
          </article>
        ))}
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="final-cta reveal" aria-label="Final call to action">
      <Image src={siteImages.finalCta.src} alt={siteImages.finalCta.alt} fill sizes="100vw" />
      <div className="final-cta-overlay" />
      <div className="page-shell final-cta-content">
        <h2>Reserve Your Table for an Unforgettable BBQ Experience!</h2>
        <p>
          Don&apos;t miss out on the ultimate BBQ experience. Reserve your table today and enjoy mouth-watering, slow
          smoked meats, flavorful sides, and exceptional service.
        </p>
        <div className="cta-row">
          <SmartLink className="btn btn-primary" href={orderingLinks.cateringInquiryUrl}>
            Reserve Now
          </SmartLink>
        </div>
      </div>
    </section>
  );
}

export function WhyUsSection() {
  return (
    <section className="page-shell section reveal">
      <article className="why-us-grid">
        <div className="why-us-images">
          <div className="why-us-image-shell">
            <Image src={siteImages.whyUsLeft.src} alt={siteImages.whyUsLeft.alt} fill sizes="(max-width: 980px) 100vw, 24vw" />
          </div>
          <div className="why-us-image-shell">
            <Image src={siteImages.whyUsRight.src} alt={siteImages.whyUsRight.alt} fill sizes="(max-width: 980px) 100vw, 24vw" />
          </div>
        </div>
        <div className="why-us-copy">
          <span className="eyebrow">{whyUsContent.eyebrow}</span>
          <h2>{whyUsContent.headline}</h2>
          <p>{whyUsContent.description}</p>
          <ul>
            {whyUsContent.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>
      </article>
    </section>
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
          <a href="/#story">About</a>
          <a href="/#menu">Menu</a>
          <a href="/#catering">Contact</a>
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
