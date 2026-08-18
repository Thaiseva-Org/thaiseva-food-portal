import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "./cn";

/**
 * Aceternity-style hover highlight for a list of cards.
 * Restyled to brand tokens for the admin panel.
 */
export function HoverEffect({ items, className, renderItem }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((item, idx) => (
        <div
          key={item.key || item.id || idx}
          className="relative"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="absolute inset-0 -z-10 rounded-2xl bg-brand-50/80"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.05 } }}
              />
            )}
          </AnimatePresence>
          {renderItem(item, idx)}
        </div>
      ))}
    </div>
  );
}
