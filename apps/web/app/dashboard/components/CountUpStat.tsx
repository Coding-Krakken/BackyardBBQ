"use client";

import { useEffect, useRef, useState } from "react";
import CountUp from "react-countup";
import { motion, useInView } from "framer-motion";
import { fadeInUp } from "../../lib/animations";

interface CountUpStatProps {
  label: string;
  value: number;
  subtext: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delay?: number;
}

export function CountUpStat({ 
  label, 
  value, 
  subtext, 
  prefix = "", 
  suffix = "",
  decimals = 0,
  delay = 0
}: CountUpStatProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  return (
    <motion.div 
      ref={ref}
      className="stat-card"
      variants={fadeInUp}
      initial="initial"
      animate={isInView ? "animate" : "initial"}
      transition={{ delay }}
    >
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {hasAnimated ? (
          <CountUp
            start={0}
            end={value}
            duration={2}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
            separator=","
            useEasing={true}
            easingFn={(t, b, c, d) => {
              // Custom easing: easeOutQuart
              t /= d;
              t--;
              return -c * (t * t * t * t - 1) + b;
            }}
          />
        ) : (
          `${prefix}0${suffix}`
        )}
      </span>
      <span className="stat-subtext">{subtext}</span>
    </motion.div>
  );
}
