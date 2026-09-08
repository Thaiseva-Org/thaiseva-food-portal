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

const displayName = (room) =>
  room?.userInfo?.displayName ||
  room?.userInfo?.name ||
  room?.restaurantName ||
  room?.ownerName ||
  "Restaurant partner";

const RestaurantChatPanel = ({ admin = false }) => {
  const { currentUser, roleData, resData } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_MESSAGE_COUNT);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!admin || !currentUser) return undefined;
    return onSnapshot(
      collection(db, "foodRestaurantChats"),
      (snapshot) => {
        const nextRooms = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(
            (left, right) =>
              timestampMillis(right.updatedAt) - timestampMillis(left.updatedAt)
          );
        setRooms(nextRooms);
        setSelectedId((value) =>
          nextRooms.some((room) => room.id === value)
            ? value
            : nextRooms[0]?.id || ""
        );
        setError("");
      },
      () => setError("Restaurant chats could not be loaded.")
    );
  }, [admin, currentUser]);

  const chatId = admin ? selectedId : currentUser?.uid || "";

  useEffect(() => {
    if (!chatId) return undefined;
    return onSnapshot(
      doc(db, "foodRestaurantChats", chatId),
      (snapshot) => {
        const value = snapshot.data();
        setMessages(Array.isArray(value?.messages) ? value.messages : []);
        setError("");
      },
      () => setError("Messages could not be loaded.")
    );
  }, [chatId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  useEffect(() => setVisibleCount(INITIAL_MESSAGE_COUNT), [chatId]);

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
      await updateDoc(doc(db, "foodRestaurantChats", room.id), {
        isReadByAdmin: true,
      });
    } catch {
      setError("Conversation could not be marked as read.");
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || !chatId || !currentUser || sending) return;
    const ownerId = admin
      ? selectedRoom?.ownerId || selectedRoom?.id
      : currentUser.uid;
    const restaurantName = admin
      ? displayName(selectedRoom)
      : resData?.name || roleData?.displayName || currentUser.email;
    const message = {
      id: `${currentUser.uid}_${Date.now()}`,
      text: body,
      senderId: currentUser.uid,
      createdAt: Timestamp.now(),
    };

    try {
      setSending(true);
      setError("");
      await setDoc(
        doc(db, "foodRestaurantChats", chatId),
        {
          ownerId,
          userId: ownerId,
          participants: [currentUser.uid, ownerId].filter(
            (value, index, values) =>
              value && values.indexOf(value) === index
          ),
          userInfo: {
            uid: ownerId,
            displayName: restaurantName,
            serviceCategory: "Restaurant",
            role: "Restaurant",
          },
          restaurantName,
          messages: arrayUnion(message),
          lastMessage: { text: body },
          isReadByAdmin: admin,
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
    <section className="p-4 md:p-6 h-[calc(100vh-5rem)] min-h-[520px] bg-slate-50/30">
      <div className="h-full overflow-hidden flex min-w-0 bg-white shadow-xl shadow-indigo-100/40 rounded-2xl border border-slate-200/60">
        {admin && (
          <aside className="w-80 shrink-0 border-r border-blue-800 overflow-y-auto bg-blue-950">
            <div className="p-5 border-b border-blue-900 bg-blue-950 sticky top-0 z-10">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Restaurant Chat
              </h1>
              <p className="text-xs text-blue-300 mt-1 font-medium">
                Direct partner support
              </p>
            </div>
            {rooms.length ? (
              rooms.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  onClick={() => selectRoom(room)}
                  className={`w-full p-4 text-left border-b border-blue-900/80 transition-all duration-200 flex flex-col gap-1.5 ${
                    selectedId === room.id
                      ? "bg-blue-900 border-l-4 border-l-blue-400"
                      : "hover:bg-blue-900/50 border-l-4 border-l-transparent"
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
                        : "text-blue-400/80"
                    }`}
                  >
                    {room.lastMessage?.text ||
                      room.lastMessage ||
                      "Open conversation"}
                  </span>
                </button>
              ))
            ) : (
              <p className="p-5 text-sm text-blue-300 text-center mt-4">
                No restaurant chats yet.
              </p>
            )}
          </aside>
        )}

        <div className="flex-1 min-w-0 flex flex-col bg-white">
          <header className="px-6 py-4 border-b border-neutral-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
              <i className="bi bi-shop text-brand-500 text-lg" />
            </div>
            <div>
              <h1 className="font-bold text-ink-heading tracking-tight">
                {admin
                  ? selectedRoom
                    ? displayName(selectedRoom)
                    : "Select a restaurant"
                  : "Thaiseva Support"}
              </h1>
              <p className="text-xs font-medium text-ink-muted">
                {admin
                  ? "Restaurant partner conversation"
                  : resData?.name ||
                    roleData?.displayName ||
                    currentUser?.email}
              </p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 space-y-4">
            {error && (
              <div className="rounded-xl bg-danger-50 border border-danger-100 p-3 text-sm text-danger-700 shadow-sm">
                {error}
              </div>
            )}
            {!chatId ? (
              <div className="h-full flex flex-col items-center justify-center text-ink-muted">
                <i className="bi bi-chat-heart text-4xl mb-3 opacity-50" />
                <p className="font-medium">
                  Choose a conversation to start chatting
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
                      className={`flex ${
                        mine ? "justify-end" : "justify-start"
                      } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${
                          mine
                            ? "bg-brand-500 text-white rounded-tr-sm shadow-brand-500/20"
                            : "bg-white border border-neutral-100 text-ink rounded-tl-sm shadow-neutral-200/50"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {message.text || message.message}
                        </p>
                        {sentAt && (
                          <p
                            className={`mt-1.5 text-[10px] font-medium tracking-wide ${
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
                <div className="bg-white p-6 rounded-full shadow-sm border border-neutral-100 mb-4">
                  <i className="bi bi-chat-dots-fill text-3xl text-brand-100" />
                </div>
                <p className="font-medium text-sm text-ink-muted">
                  Say hello to start the conversation!
                </p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-neutral-100 bg-white flex gap-3 items-center z-10"
          >
            <input
              className="flex-1 bg-slate-50 border border-neutral-200 text-ink text-sm rounded-full px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all placeholder:text-slate-400"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write your message..."
              maxLength={4000}
              disabled={!chatId || sending}
              aria-label="Message"
            />
            <button
              className="bg-brand-500 text-white rounded-full h-12 w-12 flex items-center justify-center shrink-0 hover:scale-105 hover:shadow-lg hover:shadow-brand-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100 disabled:shadow-none"
              disabled={!text.trim() || !chatId || sending}
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

export default RestaurantChatPanel;
