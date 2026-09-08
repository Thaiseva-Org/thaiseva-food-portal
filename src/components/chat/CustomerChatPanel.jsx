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
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    document.title = "Thaiseva | Customer Chat";
  }, []);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return undefined;
    return onSnapshot(
      collection(db, "foodCustomerChats"),
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
      doc(db, "foodCustomerChats", selectedId),
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
  const visibleMessages = useMemo(
    () => messages.slice(-visibleCount),
    [messages, visibleCount]
  );

  const selectRoom = async (room) => {
    setSelectedId(room.id);
    if (room.isReadByAdmin !== false) return;
    try {
      await updateDoc(doc(db, "foodCustomerChats", room.id), {
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
      createdAt: Timestamp.now(),
    };
    const customerId = selectedRoom.customerId || selectedRoom.id;
    const legacyChatId =
      selectedRoom.sourceChatId || `${customerId}_CustomerSupport`;

    try {
      setSending(true);
      setError("");
      
      await setDoc(
        doc(db, "foodCustomerChats", customerId),
        {
          customerId,
          userId: customerId,
          participants: [currentUser.uid, customerId].filter(Boolean),
          messages: arrayUnion(message),
          lastMessage: { text: body },
          isReadByAdmin: true,
          updatedAt: Timestamp.now(),
          sourceChatId: legacyChatId,
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
    <section className="p-4 md:p-6 h-[calc(100vh-5rem)] min-h-[520px] bg-slate-50/30">
      <div className="h-full overflow-hidden flex min-w-0 bg-white shadow-xl shadow-indigo-100/40 rounded-2xl border border-slate-200/60">
        <aside className="w-80 shrink-0 border-r border-violet-800 overflow-y-auto bg-violet-950">
          <div className="p-5 border-b border-violet-900 bg-violet-950 sticky top-0 z-10">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Customer Chat
            </h1>
            <p className="text-xs text-violet-300 mt-1 font-medium">
              Master Admin customer support
            </p>
          </div>
          {rooms.length ? (
            rooms.map((room) => (
              <button
                type="button"
                key={room.id}
                onClick={() => selectRoom(room)}
                className={`w-full p-4 text-left border-b border-violet-900/80 transition-all duration-200 flex flex-col gap-1.5 ${
                  selectedId === room.id
                    ? "bg-violet-900 border-l-4 border-l-violet-400"
                    : "hover:bg-violet-900/50 border-l-4 border-l-transparent"
                }`}
              >
                <span className="flex items-center justify-between w-full">
                  <span
                    className={`font-semibold truncate pr-2 ${
                      selectedId === room.id
                        ? "text-white"
                        : "text-violet-100"
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
                      ? "text-violet-200"
                      : "text-violet-400/80"
                  }`}
                >
                  {typeof room.lastMessage === "string"
                    ? room.lastMessage
                    : room.lastMessage?.text || room.lastMessage?.message || "Open conversation"}
                </span>
              </button>
            ))
          ) : (
            <p className="p-5 text-sm text-violet-300 text-center mt-4">
              No customer chats yet.
            </p>
          )}
        </aside>

        <div className="flex-1 min-w-0 flex flex-col bg-white">
          <header className="px-6 py-4 border-b border-neutral-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
              <i className="bi bi-person-fill text-violet-600 text-lg" />
            </div>
            <div>
              <h1 className="font-bold text-ink-heading tracking-tight">
                {selectedRoom ? displayName(selectedRoom) : "Select a customer"}
              </h1>
              <p className="text-xs font-medium text-ink-muted">
                Customer support conversation
              </p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 space-y-4">
            {error && (
              <div className="rounded-xl bg-danger-50 border border-danger-100 p-3 text-sm text-danger-700 shadow-sm">
                {error}
              </div>
            )}
            {!selectedId ? (
              <div className="h-full flex flex-col items-center justify-center text-ink-muted">
                <i className="bi bi-chat-heart text-4xl mb-3 opacity-50" />
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
                  const mine = message.senderId === currentUser?.uid;
                  const sentAt = messageTime(message);
                  return (
                    <div
                      key={message.id || index}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${
                          mine
                            ? "bg-violet-600 text-white rounded-tr-sm"
                            : "bg-white border border-neutral-100 text-ink rounded-tl-sm"
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
                <i className="bi bi-chat-dots-fill text-4xl text-violet-200 mb-3" />
                <p className="font-medium text-sm">No messages yet.</p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-neutral-100 bg-white flex gap-3 items-center"
          >
            <input
              className="flex-1 bg-slate-50 border border-neutral-200 text-ink text-sm rounded-full px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write your message..."
              maxLength={4000}
              disabled={!selectedId || sending}
              aria-label="Message"
            />
            <button
              className="bg-violet-600 text-white rounded-full h-12 w-12 flex items-center justify-center shrink-0 disabled:opacity-50"
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
