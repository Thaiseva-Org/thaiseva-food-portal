# Restaurant menu migration dry run

Project: `gothai-ffea1`
Run date: 2026-09-07
Mode: Read-only dry run

| Result | Count |
| --- | ---: |
| Legacy platform menu items | 90 |
| Restaurant menu copies proposed | 90 |
| Existing destination conflicts | 0 |
| Invalid or unverified restaurant mappings | 0 |
| Unassigned legacy items | 0 |

All 90 proposed copies target the verified restaurant owner `lxwHhMhuhNPFlfOi0LTwEC7IU5a2`. Destination item IDs cover `demo-ind-1` through `demo-ind-30`, `demo-ita-1` through `demo-ita-30`, and `demo-thai-1` through `demo-thai-30` under:

```text
food_items/lxwHhMhuhNPFlfOi0LTwEC7IU5a2/items/{itemId}
```

No Firestore documents were written. The apply command remains intentionally unexecuted:

```text
npm run migrate:restaurant-menus -- --apply
```

The migration script creates destination documents only when absent, initializes restaurant-specific counters at zero, derives effective availability from the legacy global/local flags, and retains all legacy data.


---
*Documentation created by Omnifex Agency*
