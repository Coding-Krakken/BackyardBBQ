"use client";

import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  title?: string;
  items: FaqItem[];
}

export function FaqSection({ title = "Frequently Asked Questions", items }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="panel">
      <span className="eyebrow">FAQ</span>
      <h2>{title}</h2>
      <div className="faq-list">
        {items.map((item, index) => (
          <article key={item.question} className="faq-item">
            <button
              type="button"
              className="faq-trigger"
              onClick={() => setOpenIndex((current) => (current === index ? -1 : index))}
              aria-expanded={openIndex === index}
            >
              <span>{item.question}</span>
              <span>{openIndex === index ? "−" : "+"}</span>
            </button>
            {openIndex === index ? <p>{item.answer}</p> : null}
          </article>
        ))}
      </div>

      <style jsx>{`
        .faq-list {
          margin-top: 1rem;
          display: grid;
          gap: 0.7rem;
        }

        .faq-item {
          border: 1px solid var(--line);
          border-radius: 0.6rem;
          padding: 0.75rem;
          background: rgba(16, 32, 41, 0.45);
        }

        .faq-trigger {
          width: 100%;
          border: 0;
          background: transparent;
          color: var(--cream);
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left;
          font-size: 1rem;
          cursor: pointer;
          padding: 0;
        }

        .faq-item p {
          margin: 0.75rem 0 0;
          color: var(--warm-gray);
        }
      `}</style>
    </section>
  );
}
