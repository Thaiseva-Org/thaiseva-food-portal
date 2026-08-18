import { NavLink } from "react-router";
import { motion } from "motion/react";
import { GradientCard } from "../../../../components/ui/gradient-card";
import StatusBadge from "../../../../components/StatusBadge";

const RestaurantMonitorHeader = ({ restaurant, onUpdateCommission }) => {
  const active = Boolean(restaurant.active);
  const rate = Number(restaurant.comission || 0);
  const base = `/foodAdmin/restaurantStats/${restaurant.ownerId}`;
  const tabs = [
    { to: base, end: true, label: "Information", icon: "bi-shop" },
    { to: `${base}/orders`, label: "Orders", icon: "bi-receipt" },
    { to: `${base}/reservations`, label: "Reservations", icon: "bi-calendar2-check" },
    { to: `${base}/finance`, label: "Finance", icon: "bi-wallet2" },
  ];

  return (
    <div className="space-y-4">
      <GradientCard>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={restaurant.imageUrl || restaurant.photo}
                alt=""
                className="h-20 w-20 rounded-2xl object-cover ring-4 ring-brand-50 sm:h-24 sm:w-24"
              />
              <span
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-2 ring-white ${
                  active ? "bg-success-500" : "bg-neutral-400"
                }`}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold text-ink-heading sm:text-2xl">
                  {restaurant.name || "Restaurant"}
                </h1>
                <StatusBadge status={active ? "Active" : "Inactive"} />
              </div>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                <i className="bi bi-hash" aria-hidden="true" />
                {restaurant.id || restaurant.ownerId}
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted">
                <i className="bi bi-geo-alt mt-0.5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2">
                  {restaurant.location || restaurant.address || "No location"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                Commission
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink-heading">
                {rate}%
                <span className="ms-1 text-xs font-medium text-ink-muted">per order</span>
              </p>
            </div>
            <button type="button" className="btn-primary" onClick={onUpdateCommission}>
              <i className="bi bi-percent" aria-hidden="true" />
              Update commission
            </button>
          </div>
        </div>
      </GradientCard>

      <nav
        className="table-shell overflow-x-auto"
        aria-label="Restaurant workspace"
      >
        <div className="filter-tabs px-1 sm:px-2" role="tablist">
          {tabs.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              role="tab"
              className={({ isActive }) =>
                `filter-tab relative ${isActive ? "filter-tab-active" : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={tab.icon} aria-hidden="true" />
                  {tab.label}
                  {isActive && (
                    <motion.span
                      layoutId="restaurant-tab"
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-600"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default RestaurantMonitorHeader;
