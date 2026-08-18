import { Pagination } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { HoverEffect } from "../../../components/ui/hover-effect";
import Loading from "../../../components/Loading";
import StatusBadge from "../../../components/StatusBadge";
import { useAuth } from "../../../AuthContext";
import {
  fetchVerifiedRestaurantPages,
  fetchVerifiedRestaurants,
} from "../../../services/RestaurantStats";
import { formatCount, formatMoney } from "../../../utils/format";

const RestaurantStatsList = () => {
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
    document.title = "Thaiseva | Restaurant Monitor";
  }, []);

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
  }, [isMasterAdmin, active, page]); // eslint-disable-line react-hooks/exhaustive-deps -- lastDocs is a pagination cursor store

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((item) => {
      const haystack = [item.name, item.id, item.location, item.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [restaurants, search]);

  return (
    <div className="page-shell animate-fade-in px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
          Master admin
        </p>
        <h1 className="page-header">Restaurant Monitor</h1>
        <p className="page-subtext mt-1 max-w-2xl">
          Open a restaurant for its profile, every order and reservation, and
          week-by-week payout invoices.
        </p>
      </div>

      <div className="panel mt-6 !px-3.5 !py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <i
              className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search loaded restaurants…"
              className="modern-input !py-2 !pl-9"
              aria-label="Search restaurants"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="py-16">
          <Loading />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state mt-8 py-16">
          <i className="bi bi-shop text-4xl text-brand-300" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-ink">
            No {active ? "active" : "inactive"} restaurants
          </p>
          <p className="mt-1 max-w-sm text-sm">
            {search
              ? "No matches in the currently loaded page."
              : "Verified restaurants will appear here."}
          </p>
        </div>
      ) : (
        <HoverEffect
          className="mt-5"
          items={filtered}
          renderItem={(item) => (
            <article className="modern-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={item.imageUrl || item.photo}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-neutral-100"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-ink">
                      {item.name || "No name"}
                    </p>
                    <StatusBadge status={active ? "Active" : "Inactive"} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {item.location || item.address || "No location"}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-brand-600">
                    #{item.id}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="badge-primary">{item.comission || 0}% commission</span>
                <span className="badge-neutral">
                  {formatCount(item.orderCount || 0)} orders
                </span>
                <span className="badge-neutral">
                  {formatMoney(item.lifetimeEarning || 0)} payout
                </span>
                <Link
                  to={`/foodAdmin/restaurantStats/${item.ownerId}`}
                  className="btn-primary !min-h-0 whitespace-nowrap px-3 py-1.5"
                >
                  Open restaurant
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
              </div>
            </article>
          )}
        />
      )}

      {totalPages > 0 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, next) => setPage(next)}
            color="primary"
            siblingCount={0}
            boundaryCount={0}
          />
        </div>
      )}
    </div>
  );
};

export default RestaurantStatsList;
