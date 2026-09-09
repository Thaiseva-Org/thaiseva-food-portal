import { useEffect, useMemo, useRef, useState } from "react";
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../AuthContext";
import { Logo } from "../../assets";
import { messageTime } from "../../utils/restaurantChat";

const INITIAL_MESSAGE_COUNT = 100;

const timestampMillis = (value) => {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const displayName = (entry) =>
  entry?.userInfo?.displayName ||
  entry?.userInfo?.name ||
  entry?.customerName ||
  entry?.email ||
  "Customer";

const CustomerChatPanel = () => {
  const { currentUser, isMasterAdmin } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_MESSAGE_COUNT);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    document.title = "Thaiseva | Food Customer Chat";
  }, []);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return undefined;
    return onSnapshot(
      collection(db, "foodCustomerSupportChats"),
      (snapshot) => {
        const customers = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(
            (left, right) =>
              timestampMillis(right.updatedAt) - timestampMillis(left.updatedAt)
          );
        setRooms(customers);
        setSelectedId((value) =>
          customers.some((room) => room.id === value)
            ? value
            : customers[0]?.id || ""
        );
        setError("");
      },
      () => setError("Customer chats could not be loaded.")
    );
  }, [currentUser, isMasterAdmin]);

  useEffect(() => {
    if (!selectedId || !isMasterAdmin) return undefined;
    return onSnapshot(
      doc(db, "foodCustomerSupportChats", selectedId),
      (snapshot) => {
        const value = snapshot.data();
        setMessages(Array.isArray(value?.messages) ? value.messages : []);
        setError("");
      },
      () => setError("Messages could not be loaded.")
    );
  }, [selectedId, isMasterAdmin]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  useEffect(() => setVisibleCount(INITIAL_MESSAGE_COUNT), [selectedId]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedId),
    [rooms, selectedId]
  );
  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter((room) =>
      [displayName(room), room.email, room.customerId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [rooms, search]);
  const visibleMessages = useMemo(
    () => messages.slice(-visibleCount),
    [messages, visibleCount]
  );

  const selectRoom = async (room) => {
    setSelectedId(room.id);
    if (room.isReadByAdmin !== false) return;
    try {
      await updateDoc(doc(db, "foodCustomerSupportChats", room.id), {
        isReadByAdmin: true,
      });
    } catch {
      setError("Conversation could not be marked as read.");
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || !selectedId || !selectedRoom || sending || !isMasterAdmin) {
      return;
    }
    const message = {
      id: `${currentUser.uid}_${Date.now()}`,
      text: body,
      senderId: currentUser.uid,
      senderType: "admin",
      createdAt: Timestamp.now(),
    };
    const customerId = selectedRoom.customerId || selectedRoom.id;
    try {
      setSending(true);
      setError("");
      
      await setDoc(
        doc(db, "foodCustomerSupportChats", customerId),
        {
          customerId,
          userId: customerId,
          channel: "food",
          schemaVersion: 1,
          participants: [currentUser.uid, customerId].filter(Boolean),
          messages: arrayUnion(message),
          lastMessage: { text: body, senderType: "admin" },
          isReadByAdmin: true,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      setText("");
    } catch (sendError) {
      console.error(sendError);
      setError("Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="h-[calc(100vh-5rem)] min-h-[560px] bg-slate-50/30 p-3 md:p-6">
      <div className="flex h-full min-w-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl shadow-indigo-100/40">
        <aside className="w-[18rem] shrink-0 overflow-y-auto border-r border-blue-800 bg-blue-950 sm:w-80">
          <div className="sticky top-0 z-10 border-b border-blue-900 bg-blue-950/95 p-5 backdrop-blur">
            <div className="mb-3 flex items-center gap-3">
              <img
                src={Logo}
                alt="Thaiseva"
                className="h-11 w-11 rounded-xl bg-white object-contain p-1 shadow-lg shadow-blue-950/30"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Thaiseva support</p>
                <h1 className="text-lg font-bold tracking-tight text-white">Customer inbox</h1>
              </div>
            </div>
            <label className="relative block">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-blue-200" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search food customers"
                className="w-full rounded-xl border border-white/10 bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-blue-200/70 focus:border-blue-300 focus:ring-2 focus:ring-blue-300/20"
                aria-label="Search food customer chats"
              />
            </label>
          </div>
          {filteredRooms.length ? (
            filteredRooms.map((room) => (
              <button
                type="button"
                key={room.id}
                onClick={() => selectRoom(room)}
                className={`flex w-full flex-col gap-1.5 border-b border-white/10 border-l-4 p-4 text-left transition-all duration-200 ${
                  selectedId === room.id
                    ? "border-l-blue-400 bg-blue-900"
                    : "border-l-transparent hover:bg-white/5"
                }`}
              >
                <span className="flex items-center justify-between w-full">
                  <span
                    className={`font-semibold truncate pr-2 ${
                      selectedId === room.id
                        ? "text-white"
                        : "text-blue-100"
                    }`}
                  >
                    {displayName(room)}
                  </span>
                  {room.isReadByAdmin === false && (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500/40" />
                  )}
                </span>
                <span
                  className={`text-xs truncate w-full ${
                    selectedId === room.id
                        ? "text-blue-200"
                        : "text-blue-300/70"
                  }`}
                >
                  {typeof room.lastMessage === "string"
                    ? room.lastMessage
                    : room.lastMessage?.text || room.lastMessage?.message || "Open conversation"}
                </span>
              </button>
            ))
          ) : (
            <p className="mt-4 p-5 text-center text-sm text-blue-300">
              {search ? "No matching food customers." : "No food customer chats yet."}
            </p>
          )}
        </aside>

        <div className="flex-1 min-w-0 flex flex-col bg-white">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-100 bg-white/90 px-6 py-4 backdrop-blur-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <i className="bi bi-person-fill text-lg text-brand-600" />
            </div>
            <div>
              <h1 className="font-bold text-ink-heading tracking-tight">
                {selectedRoom ? displayName(selectedRoom) : "Select a customer"}
              </h1>
              <p className="text-xs font-medium text-ink-muted">
                Dedicated food-order support
              </p>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-6">
            {error && (
              <div className="rounded-xl bg-danger-50 border border-danger-100 p-3 text-sm text-danger-700 shadow-sm">
                {error}
              </div>
            )}
            {!selectedId ? (
              <div className="h-full flex flex-col items-center justify-center text-ink-muted">
                <i className="bi bi-chat-heart mb-3 text-4xl text-brand-200" />
                <p className="font-medium">
                  Choose a customer conversation to start chatting
                </p>
              </div>
            ) : messages.length ? (
              <>
                {messages.length > visibleMessages.length && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="btn-outline px-3 py-1.5 text-xs"
                      onClick={() =>
                        setVisibleCount(
                          (count) => count + INITIAL_MESSAGE_COUNT
                        )
                      }
                    >
                      Show earlier messages
                    </button>
                  </div>
                )}
                {visibleMessages.map((message, index) => {
                  const mine =
                    message.senderType === "admin" ||
                    message.senderId === currentUser?.uid;
                  const sentAt = messageTime(message);
                  return (
                    <div
                      key={message.id || index}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${
                          mine
                            ? "rounded-tr-sm bg-brand-500 text-white shadow-brand-500/20"
                            : "rounded-tl-sm border border-neutral-100 bg-white text-ink shadow-neutral-200/50"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {typeof message.text === "string" ? message.text : typeof message.message === "string" ? message.message : "Message"}
                        </p>
                        {sentAt && (
                          <p
                            className={`mt-1.5 text-[10px] font-medium ${
                              mine ? "text-white/80" : "text-ink-subtle"
                            }`}
                          >
                            {sentAt.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-ink-muted">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-400">
                  <i className="bi bi-chat-dots-fill text-3xl" />
                </div>
                <p className="text-sm font-medium">No food support messages yet.</p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={sendMessage}
            className="flex items-center gap-3 border-t border-neutral-100 bg-white p-4"
          >
            <input
              className="flex-1 rounded-full border border-neutral-200 bg-slate-50 px-5 py-3.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Reply to this food customer..."
              maxLength={4000}
              disabled={!selectedId || sending}
              aria-label="Message"
            />
            <button
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!text.trim() || !selectedId || sending}
              aria-label="Send message"
            >
              {sending ? (
                <i className="bi bi-hourglass-split animate-spin text-lg" />
              ) : (
                <i className="bi bi-send-fill text-lg ml-0.5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default CustomerChatPanel;
