# Food partner ↔ food master admin messaging

Updated 19 October 2026. Uses the existing partner/master web screens; no mobile UI is included.

Callable: `foodPartnerChat`, Firebase project `gothai-ffea1`, region **asia-southeast1**. This region differs from the general Thaiseva customer-chat API (`asia-east2`). Authentication and App Check follow the food portal's existing callable configuration. Callers must initialize App Check where enforcement is enabled.

The server checks current Firebase Auth claims, revocation time, suspension, restaurant ownership and verification. A general Thaiseva admin claim alone does not grant food master access. Partners cannot request another owner's thread or the master inbox. Food customers use their existing separate customer-support API.

## Client usage

The web portal uses `src/api/partnerChat.js`:

```js
const {conversation} = await partnerChatApi('open');
const {items, nextCursor} = await partnerChatApi('messages', {limit:30});
const pending = {requestId: crypto.randomUUID(), text:'Please help with my menu'};
await partnerChatApi('send', pending);
```

Generate a request ID once per message and keep it unchanged across retries. If the send times out, retry the same request; a changed payload requires a new ID. The web composer locks the payload after a failed send until retry or cancellation.

For another app using the Firebase SDK:

```js
const fn = httpsCallable(getFunctions(firebaseApp, 'asia-southeast1'), 'foodPartnerChat');
const response = await fn({action:'messages', limit:30});
const page = response.data.data; // Existing food callable envelope: {ok:true,data:{...}}.
```

Raw callable HTTP protocol:

```http
POST https://asia-southeast1-gothai-ffea1.cloudfunctions.net/foodPartnerChat
Authorization: Bearer FIREBASE_ID_TOKEN
Content-Type: application/json
X-Firebase-AppCheck: APP_CHECK_TOKEN_WHEN_ENFORCED

{"data":{"action":"send","requestId":"STABLE_UUID","text":"Hello master admin"}}
```

Response: `{"result":{"ok":true,"data":{"message":{...}}}}`. Callable errors carry Firebase codes such as `permission-denied`, `invalid-argument`, `already-exists` and `resource-exhausted`. Never include service-account credentials in an app.

## Actions

Partners omit `ownerId` or supply their own UID. Food master admin supplies the target `ownerId` for conversation actions.

| Action | Input | Result |
|---|---|---|
| `open` | optional `ownerId` for master | Creates metadata only if missing; returns `{conversation}` |
| `send` | `requestId`, `text`, target `ownerId` for master | `{message}` with server identity/time; maximum 4,000 characters, 30 sends/minute |
| `messages` | optional `limit` 1–50 and `cursor`, target `ownerId` for master | `{items,nextCursor,conversation}`; newest first; timestamps are Unix milliseconds |
| `read` | `throughMessageId` from the returned `conversation.lastMessageId` | Clears the caller's unread flag only if no newer message has arrived |
| `inbox` | master only; optional `cursor` | `{items,nextCursor}`; 30 conversations/page |
| `unreadCount` | master only | `{count}` unread partner conversations |

Refresh current messages every five seconds only while visible; cancel timers on background/sign-out and avoid overlapping requests. Call `read` after displaying the latest page. Inbox/count refresh every ten seconds. Earlier-history mode pauses latest-message replacement until the user returns to latest.

## Data compatibility and release

New messages use individual records at `foodRestaurantChats/{ownerUid}/messages/{messageId}`. Existing message arrays remain unchanged and are returned through cursor pagination after the new-message pages. No destructive history migration is necessary. Legacy messages receive stable synthetic IDs and `legacy:true`.

Shared Firestore rules permit legacy authorized reads but deny direct client creation, updates and deletion of food partner conversations. New nested messages are API-only. Release the callable first, then the updated food hosting, then the canonical rules. Previous web builds that write directly will need a refresh after the rules release.

This endpoint covers text conversations and read status. Existing food-customer chat, ordering, payments, and restaurant onboarding are unchanged. It does not add media uploads, push notifications, search or mobile screens to food partner chat.
