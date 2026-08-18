import { cn } from "./cn";

export function BentoGrid({ className, children }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({ className, title, description, header, icon, children }) {
  return (
    <div
      className={cn(
        "group/bento panel relative overflow-hidden rounded-2xl transition duration-200 hover:shadow-card-hover",
        className
      )}
    >
      {header}
      <div className="transition duration-200">
        {icon}
        {title && <h3 className="section-title">{title}</h3>}
        {description && <p className="page-subtext mt-1">{description}</p>}
        {children}
      </div>
    </div>
  );
}
