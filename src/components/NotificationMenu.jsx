import { useEffect, useId, useRef, useState } from "react";
import { format } from "timeago.js";

const NotificationArtwork = ({ notification }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const source = notification.image || notification.imageUrl;

  if (!source || imageFailed) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
        <i className="bi bi-bell-fill text-lg" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={source}
      className="h-14 w-14 shrink-0 rounded-xl border border-neutral-100 object-cover"
      alt=""
      onError={() => setImageFailed(true)}
    />
  );
};

const NotificationMenu = ({
  notifications,
  unreadCount,
  loading,
  error,
  markAllAsRead,
  isOpen,
  onToggle,
  onClose,
}) => {
  const rootRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) onClose();
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={onToggle}
        className={`relative flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-brand-600 shadow-sm transition-colors duration-fast hover:bg-brand-50 focus-ring ${
          unreadCount > 0 ? "animate-pulse-subtle" : ""
        }`}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
      >
        <i className="bi bi-bell-fill text-lg" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          id={panelId}
          className="notif-panel"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-heading">
                Notifications
              </h2>
              {!loading && !error && notifications.length > 0 && (
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : "You’re all caught up"}
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 focus-ring"
              >
                Mark all read
              </button>
            )}
          </div>

          {loading && (
            <div className="py-8 text-center text-sm text-ink-muted" role="status">
              Loading notifications…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-xl bg-danger-50 px-3 py-4 text-center text-sm text-danger-700" role="alert">
              {error}
            </div>
          )}
          {!loading && !error && notifications.length === 0 && (
            <div className="py-8 text-center text-ink-muted">
              <i className="bi bi-bell text-2xl" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs text-ink-subtle">
                New activity will appear here.
              </p>
            </div>
          )}
          {!loading && !error && notifications.length > 0 && (
            <div role="list">
              {notifications.map((item) => (
                <article
                  key={item.id}
                  className="flex gap-3 border-t border-neutral-100 py-3 first:border-0"
                  role="listitem"
                >
                  <NotificationArtwork notification={item} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {item.title || "Notification"}
                    </p>
                    {item.desc && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
                        {item.desc}
                      </p>
                    )}
                    <p className="mt-1 text-end text-xs text-ink-subtle">
                      {item.timestamp?.toDate
                        ? format(item.timestamp.toDate())
                        : "Just now"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default NotificationMenu;
