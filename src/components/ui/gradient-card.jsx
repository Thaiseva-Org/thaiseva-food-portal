import { cn } from "./cn";

/** Subtle brand-gradient frame for the restaurant identity header. */
export function GradientCard({ className, children }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-brand-gradient p-[1px] shadow-card",
        className
      )}
    >
      <div className="rounded-[15px] bg-white p-4 sm:p-5">{children}</div>
    </div>
  );
}
