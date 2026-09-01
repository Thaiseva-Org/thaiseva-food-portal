import { Pagination } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { HoverEffect } from "../../../../components/ui/hover-effect";
import Loading from "../../../../components/Loading";
import StatusBadge from "../../../../components/StatusBadge";
import { useAuth } from "../../../../AuthContext";
import { DashSection } from "../../../../components/dashboard";
import {
  fetchVerifiedRestaurantPages,
  fetchVerifiedRestaurants,
} from "../../../../services/RestaurantStats";
import { formatCount, formatMoney } from "../../../../utils/format";
import { isPlatformOwnerId } from "../../../../utils/platformRestaurant";

const NetworkMonitorSection = () => {
  const { isMasterAdmin } = useAuth();
  const [active, setActive] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isMasterAdmin) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const pages = await fetchVerifiedRestaurantPages(active);
        const { restaurants: rows, lastDoc } = await fetchVerifiedRestaurants({
          active,
          page,
          lastDocs,
        });
        if (cancelled) return;
        setTotalPages(pages);
        setRestaurants(rows);
        setLastDocs((prev) => {
          const next = [...prev];
          next[page] = lastDoc;
          return next;
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load restaurants.");
          setRestaurants([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isMasterAdmin, active, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const partners = restaurants.filter(
      (item) => !isPlatformOwnerId(item.ownerId || item.docId)
    );
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((item) => {
      const haystack = [item.name, item.id, item.location, item.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [restaurants, search]);

  return (
    <DashSection
      title="Network Partners"
      subtitle="Search, track, and manage all registered partner restaurants"
      action={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <div className="period-toggle" role="group" aria-label="Restaurant status">
            <button
              type="button"
              className={`period-toggle-btn ${active ? "period-toggle-btn-active" : ""}`}
              onClick={() => {
                setActive(true);
                setPage(1);
                setLastDocs([]);
              }}
            >
              Active
            </button>
            <button
              type="button"
              className={`period-toggle-btn ${!active ? "period-toggle-btn-active" : ""}`}
              onClick={() => {
                setActive(false);
                setPage(1);
                setLastDocs([]);
              }}
            >
              Inactive
            </button>
          </div>
          <div className="relative min-w-[200px] sm:min-w-[260px]">
            <i
              className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-xs"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner..."
              className="modern-input !py-1.5 !pl-8 text-xs"
              aria-label="Search restaurants"
            />
          </div>
        </div>
      }
    >
      {error && (
        <p className="mt-2 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="py-12">
          <Loading />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state py-12">
          <i className="bi bi-shop text-3xl text-brand-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-ink">
            No {active ? "active" : "inactive"} restaurants found
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {search
              ? "No matches in the current page."
              : "Verified restaurants will appear here."}
          </p>
        </div>
      ) : (
        <HoverEffect
          className="mt-3"
          items={filtered}
          renderItem={(item) => (
            <article className="modern-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={item.imageUrl || item.photo}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-neutral-100"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-ink text-sm">
                      {item.name || "No name"}
                    </p>
                    <StatusBadge status={active ? "Active" : "Inactive"} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {item.location || item.address || "No location"}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-brand-600">
                    #{item.id}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end text-xs">
                <span className="badge-primary !text-[11px] !py-0.5">{item.comission || 0}% commission</span>
                <span className="badge-neutral !text-[11px] !py-0.5">
                  {formatCount(item.orderCount || 0)} orders
                </span>
                <span className="badge-neutral !text-[11px] !py-0.5">
                  {formatMoney(item.lifetimeEarning || 0)} payout
                </span>
                <Link
                  to={`/foodAdmin/restaurantStats/${item.ownerId}`}
                  className="btn-primary !min-h-0 whitespace-nowrap px-2.5 py-1 text-xs"
                >
                  Open restaurant
                  <i className="bi bi-arrow-right ml-1" aria-hidden="true" />
                </Link>
              </div>
            </article>
          )}
        />
      )}

      {totalPages > 0 && (
        <div className="mt-4 flex justify-center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, next) => setPage(next)}
            color="primary"
            size="small"
            siblingCount={0}
            boundaryCount={0}
          />
        </div>
      )}
    </DashSection>
  );
};

export default NetworkMonitorSection;
