import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../AuthContext";
import { messageTime } from "../../utils/restaurantChat";
import { partnerChatApi } from "../../api/partnerChat";
import { newIdempotencyKey } from "../../api/client";
import "./restaurantChat.css";

const displayName = (room) =>
  room?.restaurantName || room?.userInfo?.displayName || "Restaurant partner";
const mergeMessages = (items) => [
  ...new Map(items.map((item) => [item.id, item])).values(),
];

const RestaurantChatPanel = ({ admin = false }) => {
  const { currentUser, roleData, resData } = useAuth();
  const currentUid = currentUser?.uid;
  const [rooms, setRooms] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showingOlder, setShowingOlder] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(admin);
  const [messageLoading, setMessageLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const inboxPaged = useRef(false);
  const timelineRef = useRef(null);
  const scrollState = useRef({ chatId: "", lastId: "" });
  const endRef = useRef(null);
  const pending = useRef(null);
  const generation = useRef(0);
  const older = useRef(false);
  const chatId = admin ? selectedId : currentUid || "";

  useEffect(() => {
    if (!admin || !currentUid) return undefined;
    let alive = true;
    let timer;
    async function poll() {
      try {
        if (!document.hidden) {
          const result = await partnerChatApi("inbox");
          if (alive) {
            setRooms((previous) => [
              ...result.items,
              ...previous.filter(
                (item) => !result.items.some((fresh) => fresh.id === item.id),
              ),
            ]);
            if (!inboxPaged.current) setInboxCursor(result.nextCursor);
            setInboxLoading(false);
            setSelectedId((value) => value || result.items[0]?.id || "");
          }
        }
      } catch (err) {
        if (alive) {
          setError(err.message);
          setInboxLoading(false);
        }
      }
      if (alive) timer = setTimeout(poll, 10000);
    }
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [admin, currentUid]);

  useEffect(() => {
    generation.current += 1;
    setMessages([]);
    setCursor(null);
    setError("");
    setText("");
    setQuery("");
    setSearchOpen(false);
    setConversation(null);
    setMessageLoading(!!chatId);
    pending.current = null;
    older.current = false;
    setShowingOlder(false);
    setLoadingOlder(false);
    if (!chatId || !currentUid) return undefined;
    let alive = true;
    let timer;
    async function poll() {
      try {
        if (!document.hidden && !older.current) {
          const result = await partnerChatApi("messages", { ownerId: chatId });
          if (alive) {
            setMessages(result.items);
            setCursor(result.nextCursor);
            const room = result.conversation;
            setConversation(room);
            if (
              room?.lastMessageId &&
              (admin
                ? room.isReadByAdmin === false
                : room.isReadByOwner === false)
            ) {
              await partnerChatApi("read", {
                ownerId: chatId,
                throughMessageId: room.lastMessageId,
              });
            }
          }
        }
      } catch (err) {
        if (alive) setError(err.message);
      }
      if (alive) setMessageLoading(false);
      if (alive) timer = setTimeout(poll, 5000);
    }
    async function start() {
      try {
        if (!admin) await partnerChatApi("open");
      } catch (err) {
        if (alive) {
          setError(err.message);
          setMessageLoading(false);
        }
        return;
      }
      if (alive) poll();
    }
    start();
    return () => {
      alive = false;
      clearTimeout(timer);
      generation.current += 1;
    };
  }, [admin, chatId, currentUid]);

  const [inboxCursor, setInboxCursor] = useState(null);
  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedId),
    [rooms, selectedId],
  );
  const visibleMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          (messageTime(a)?.getTime() || 0) - (messageTime(b)?.getTime() || 0),
      ),
    [messages],
  );
  useEffect(() => {
    if (!chatId || !visibleMessages.length || showingOlder || query) return;
    const lastId = visibleMessages[visibleMessages.length - 1].id;
    const timeline = timelineRef.current;
    const nearBottom =
      timeline &&
      timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight < 180;
    if (
      scrollState.current.chatId !== chatId ||
      (scrollState.current.lastId !== lastId && nearBottom)
    ) {
      endRef.current?.scrollIntoView({ block: "end" });
    }
    scrollState.current = { chatId, lastId };
  }, [chatId, visibleMessages, showingOlder, query]);
  const visibleRooms = rooms.filter(
    (room) =>
      (!unreadOnly || room.isReadByAdmin === false) &&
      displayName(room).toLowerCase().includes(filter.toLowerCase()),
  );
  const filteredMessages = visibleMessages.filter((message) =>
    String(message.text || message.message || "")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const restaurantName =
    resData?.name || roleData?.displayName || "Your restaurant";
  const title = admin
    ? selectedRoom
      ? displayName(selectedRoom)
      : "Select a restaurant"
    : "Food Master Admin";
  const unread = rooms.filter((room) => room.isReadByAdmin === false).length;

  const selectRoom = (room) => {
    if (!sending) setSelectedId(room.id);
  };
  const showEarlier = async () => {
    if (!cursor || loadingOlder) return;
    const version = generation.current;
    setLoadingOlder(true);
    older.current = true;
    setShowingOlder(true);
    try {
      const result = await partnerChatApi("messages", {
        ownerId: chatId,
        cursor,
      });
      if (generation.current === version) {
        setMessages((previous) =>
          mergeMessages([...previous, ...result.items]),
        );
        setCursor(result.nextCursor);
      }
    } catch (err) {
      if (generation.current === version) setError(err.message);
    } finally {
      if (generation.current === version) setLoadingOlder(false);
    }
  };
  const sendMessage = async (event) => {
    event.preventDefault();
    if (!text.trim() || !chatId || !currentUid || sending) return;
    const version = generation.current;
    if (!pending.current)
      pending.current = {
        ownerId: chatId,
        text: text.trim(),
        requestId: newIdempotencyKey("food-chat"),
      };
    setSending(true);
    setError("");
    try {
      const result = await partnerChatApi("send", pending.current);
      if (generation.current === version) {
        pending.current = null;
        setText("");
        setMessages((previous) => mergeMessages([result.message, ...previous]));
        older.current = false;
        setShowingOlder(false);
        requestAnimationFrame(() =>
          endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
        );
      }
    } catch (err) {
      if (generation.current === version)
        setError(
          `${err.message} Retry sends the same message once; cancel retry to change it.`,
        );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="p-4 md:p-6">
      <div className="restaurant-chat support-inbox bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col">
        <div className="support-titlebar border-b p-4">
          <div>
            <p className="support-eyebrow">THAISEVA • FOOD SUPPORT</p>
            <h1 className="text-xl font-bold">Restaurant Chat</h1>
            <p className="text-sm text-neutral-500">
              {admin
                ? "One inbox for your restaurant conversations."
                : "Your direct conversation with Food Master Admin."}
            </p>
          </div>
          <span className="support-private">Private restaurant support</span>
        </div>
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700"
          >
            <p className="flex-1">{error}</p>
            {pending.current && (
              <button
                type="button"
                disabled={sending}
                className="underline"
                onClick={() => {
                  pending.current = null;
                  setError("");
                }}
              >
                Cancel retry
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          <aside
            className={`support-sidebar w-full md:w-80 border-r overflow-auto ${admin ? "" : "hidden md:block"}`}
          >
            {admin ? (
              <>
                <div className="px-1 mb-4 space-y-3">
                  <input
                    className="w-full border px-3 py-2 text-sm"
                    aria-label="Search loaded restaurants"
                    placeholder="Search loaded restaurants…"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                  <div className="flex gap-2" aria-label="Filter conversations">
                    {[
                      [false, "All"],
                      [true, `Unread (${unread})`],
                    ].map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={unreadOnly === value}
                        className={`rounded-full px-3 py-1.5 text-xs ${unreadOnly === value ? "bg-brand-50 text-brand-700 font-semibold" : "text-neutral-500 hover:bg-neutral-100"}`}
                        onClick={() => setUnreadOnly(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {inboxLoading ? (
                  <p role="status" className="support-empty">
                    Loading conversations…
                  </p>
                ) : (
                  !visibleRooms.length && (
                    <p className="support-empty">
                      {rooms.length
                        ? "No matching restaurants."
                        : "No restaurant conversations yet."}
                    </p>
                  )
                )}
                {visibleRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    disabled={sending}
                    aria-pressed={selectedId === room.id}
                    onClick={() => selectRoom(room)}
                    className="support-conversation w-full text-left rounded-xl border"
                  >
                    <span className="support-avatar" aria-hidden="true">
                      {displayName(room).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="support-conversation-copy">
                      <div className="flex items-center justify-between gap-2">
                        <strong>{displayName(room)}</strong>
                        {room.isReadByAdmin === false && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-brand-600"
                            aria-label="Unread messages"
                          />
                        )}
                      </div>
                      <p className="truncate">
                        {typeof room.lastMessage === "string"
                          ? room.lastMessage
                          : room.lastMessage?.text ||
                            room.lastMessage?.message ||
                            "Start a conversation"}
                      </p>
                      <span className="text-[10px] text-neutral-500">
                        Restaurant Admin
                      </span>
                    </div>
                  </button>
                ))}
                {inboxCursor && (
                  <button
                    type="button"
                    className="m-3 text-xs text-brand-700 underline"
                    onClick={async () => {
                      try {
                        const result = await partnerChatApi("inbox", {
                          cursor: inboxCursor,
                        });
                        inboxPaged.current = true;
                        setRooms((previous) =>
                          mergeMessages([...previous, ...result.items]),
                        );
                        setInboxCursor(result.nextCursor);
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  >
                    Load more conversations
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                aria-pressed="true"
                className="support-conversation w-full text-left rounded-xl border"
              >
                <span className="support-avatar" aria-hidden="true">
                  T
                </span>
                <div className="support-conversation-copy">
                  <strong>Food Master Admin</strong>
                  <p className="truncate">
                    {typeof conversation?.lastMessage === "string"
                      ? conversation.lastMessage
                      : conversation?.lastMessage?.text || restaurantName}
                  </p>
                  <span className="text-[10px] text-neutral-500">
                    Your support conversation
                  </span>
                </div>
              </button>
            )}
          </aside>
          <main className="flex flex-1 min-w-0 min-h-0 flex-col">
            {!chatId ? (
              <div className="support-welcome text-center">
                <span className="support-welcome-icon" aria-hidden="true">
                  ↗
                </span>
                <h2>Your restaurant inbox</h2>
                <p>
                  Select a restaurant to view messages and help with their next
                  request.
                </p>
                <span className="support-welcome-note">
                  Food Master Admin ↔ Restaurant Admin
                </span>
              </div>
            ) : (
              <>
                <header className="support-chat-header border-b flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="support-avatar" aria-hidden="true">
                      {title.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-bold truncate">{title}</h2>
                      <p className="text-xs text-neutral-500">
                        {admin ? "Restaurant Admin" : restaurantName} · Private
                        conversation
                      </p>
                    </div>
                  </div>
                </header>
                <nav
                  className="support-tabs flex border-b"
                  aria-label="Conversation content"
                >
                  <button
                    type="button"
                    aria-current={!searchOpen ? "page" : undefined}
                    onClick={() => {
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    Messages
                  </button>
                  <button
                    type="button"
                    aria-current={searchOpen ? "page" : undefined}
                    onClick={() => setSearchOpen(true)}
                  >
                    Search
                  </button>
                </nav>
                {searchOpen && (
                  <div className="border-b p-3">
                    <input
                      type="search"
                      className="w-full border px-3 py-2 text-sm"
                      placeholder="Find a message in loaded history…"
                      aria-label="Search loaded messages"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      Searches loaded messages. Load earlier messages to include
                      more history.
                    </p>
                  </div>
                )}
                <div
                  ref={timelineRef}
                  className="support-timeline overflow-auto space-y-3"
                  aria-live="polite"
                  aria-busy={messageLoading}
                >
                  {showingOlder && (
                    <div className="text-center">
                      <button
                        type="button"
                        className="rounded-full border bg-white px-3 py-2 text-xs text-brand-700"
                        onClick={() => {
                          older.current = false;
                          setShowingOlder(false);
                        }}
                      >
                        Return to latest messages
                      </button>
                    </div>
                  )}
                  {cursor && (
                    <div className="text-center">
                      <button
                        type="button"
                        className="rounded-full border bg-white px-3 py-2 text-xs text-neutral-500"
                        onClick={showEarlier}
                        disabled={loadingOlder}
                      >
                        {loadingOlder ? "Loading…" : "Load earlier messages"}
                      </button>
                    </div>
                  )}
                  {messageLoading ? (
                    <p role="status" className="support-empty">
                      Loading conversation…
                    </p>
                  ) : (
                    !filteredMessages.length && (
                      <p className="support-empty">
                        {query
                          ? "No matching messages in loaded history."
                          : "Say hello to start the conversation."}
                      </p>
                    )
                  )}
                  {filteredMessages.map((message, index) => {
                    const mine = message.senderType
                      ? admin
                        ? message.senderType === "masterAdmin"
                        : message.senderType === "partner"
                      : message.senderId === currentUid;
                    const sentAt = messageTime(message);
                    const previous = index
                      ? messageTime(filteredMessages[index - 1])
                      : null;
                    const readAt = admin
                      ? conversation?.ownerReadAt
                      : conversation?.adminReadAt;
                    return (
                      <div key={message.id || index}>
                        {sentAt &&
                          (!previous ||
                            previous.toDateString() !==
                              sentAt.toDateString()) && (
                            <div className="support-day">
                              <span>
                                {sentAt.toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          )}
                        <article
                          className={`support-bubble max-w-[92%] md:max-w-[80%] border ${mine ? "support-bubble-admin ml-auto" : "bg-white"}`}
                        >
                          <div>
                            {mine
                              ? admin
                                ? "Food Master Admin"
                                : "Restaurant Admin"
                              : admin
                                ? "Restaurant Admin"
                                : "Food Master Admin"}{" "}
                            ·{" "}
                            {sentAt?.toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            }) || "Imported message"}
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {typeof message.text === "string"
                              ? message.text
                              : message.message || "Message"}
                          </p>
                          {mine && (
                            <p className="mt-2 text-right text-[10px] text-neutral-500">
                              {sentAt && readAt >= sentAt.getTime()
                                ? "Read"
                                : "Sent"}
                            </p>
                          )}
                        </article>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <form
                  onSubmit={sendMessage}
                  className="support-composer border-t space-y-2"
                >
                  <div className="flex items-end gap-3">
                    <textarea
                      className="flex-1 min-w-0 resize-none border px-3 py-3 text-sm"
                      rows={2}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Write a message…"
                      maxLength={4000}
                      disabled={sending || !!pending.current}
                      aria-label="Message"
                    />
                    <button
                      className="support-send rounded-lg px-5 py-3 text-sm text-white disabled:opacity-50"
                      disabled={!text.trim() || sending}
                    >
                      {sending
                        ? "Sending…"
                        : pending.current
                          ? "Retry"
                          : "Send"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <span>Food Master Admin ↔ Restaurant Admin</span>
                    <span>{text.length}/4000</span>
                  </div>
                </form>
              </>
            )}
          </main>
        </div>
      </div>
    </section>
  );
};

export default RestaurantChatPanel;
