# Security Specification — Atelier Vela (Celebration & Event Planner)

## 1. Data Invariants

1. **Default-Deny Catch-All**: All paths in `/databases/{database}/documents/{document=**}` are denied by default unless explicitly matched.
2. **Verified Identity Invariant**: All write operations (`create`, `update`, `delete`) require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
3. **Path Variable Hardening (ID Poisoning Guard)**: Every single-document target operation (`get`, `create`, `update`, `delete`) validates all path ID variables (`eventId`, `memberId`, `itemId`, `vendorId`, `guestId`, `ideaId`, `noteId`) against `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`). `isValidId` is never applied to the target collection variable in `allow list`.
4. **Master Gate (Relational Sync)**: Subcollections under `/events/{eventId}` (`members`, `budgetItems`, `timelineItems`, `vendors`, `guests`, `ideas`, `collabNotes`) verify parent existence and membership on single-document operations via `get(/databases/$(database)/documents/events/$(eventId))`.
5. **Zero-Lookup Secure List Queries**: Every `allow list` rule enforces access strictly against `resource.data` (`resource.data.ownerId == request.auth.uid`, `resource.data.eventOwnerId == request.auth.uid`, `resource.data.authorId == request.auth.uid`, or `request.auth.uid in resource.data.collaboratorUids`) without any `get()` or `exists()` calls.
6. **Validation Blueprints (Anti-Update-Gap)**: Every `create` and `update` rule calls `isValid[Entity](incoming())` first, enforcing strict key sets (`hasAll` and `hasOnly`), string length bounds, enum membership, bounded `collaboratorUids` list (`size() <= 10` and element check), and numerical bounds.
7. **Temporal & Identity Immutability**:
   - On `create`: `incoming().createdAt == request.time && incoming().updatedAt == request.time` and creator UID fields (`ownerId` / `authorId` / `userId`) must equal `request.auth.uid`.
   - On `update`: `incoming().updatedAt == request.time && incoming().createdAt == existing().createdAt` and immutable identity links (`ownerId`, `eventId`, `eventOwnerId`, `authorId`, `userId`) cannot change.
8. **Terminal State Locking**: Once an `EventPlan` reaches `status == 'archived'`, no further updates are permitted (`existing().status != 'archived'`).
9. **PII Isolation**: No raw email addresses, phone numbers, or street addresses are stored in `events` or any subcollection documents.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Event Creation)**: Creating `/events/evt_1` with `ownerId: "victim_uid_999"` while authenticated as `"attacker_uid_111"`. Rejected by `incoming().ownerId == request.auth.uid`.
2. **Payload 2 (Unverified Email Write)**: Creating `/events/evt_1` with `request.auth.token.email_verified == false`. Rejected by `isVerifiedUser()`.
3. **Payload 3 (Shadow Field Injection on Create)**: Creating `/events/evt_1` with extra field `isAdminBypass: true`. Rejected by `data.keys().hasOnly(...)` inside `isValidEventPlan()`.
4. **Payload 4 (Update-Gap / Value Poisoning on Update)**: Updating `/events/evt_1` `title` to a 50,000-character string or boolean `true`. Rejected because `isValidEventPlan(incoming())` wraps the entire `allow update` block.
5. **Payload 5 (ID Poisoning Attack)**: Creating `/events/evil$id!@#with spaces` or a 500-char ID. Rejected by `isValidId(eventId)`.
6. **Payload 6 (Terminal State Bypass)**: Updating `/events/evt_archived` when `existing().status == 'archived'`. Rejected by `existing().status != 'archived'`.
7. **Payload 7 (Timestamp Forgery)**: Creating or updating `/events/evt_1/budgetItems/item_1` with a client-forged past/future `createdAt` or `updatedAt` != `request.time`. Rejected by `incoming().createdAt == request.time` and `incoming().updatedAt == request.time`.
8. **Payload 8 (Orphaned Subcollection Write)**: Creating `/events/non_existent_evt/budgetItems/item_1` where `/events/non_existent_evt` does not exist or user is not in parent event. Rejected by Master Gate `canAccessParentEvent(eventId)`.
9. **Payload 9 (Immortal Field Mutation)**: Updating `ownerId` or `createdAt` on `/events/evt_1` or `authorId` on `/events/evt_1/vendors/v_1`. Rejected by immutability guards and `affectedKeys().hasOnly(...)`.
10. **Payload 10 (Unbounded Array Exhaustion)**: Setting `collaboratorUids` to 50 elements or non-string first element. Rejected by `isValidCollaboratorList(data.collaboratorUids)` (`list.size() <= 10`).
11. **Payload 11 (Unauthorized List Scraping)**: Running an unfiltered `getDocs(collection(db, 'events'))` as an unrelated user. Rejected by `allow list` checking `resource.data.ownerId == request.auth.uid || request.auth.uid in resource.data.collaboratorUids`.
12. **Payload 12 (Privilege Escalation in EventMember)**: A guest joining `/events/evt_1/members/attacker_uid` claiming `role: 'owner'` when not the parent event's `ownerId`. Rejected by role consistency check against parent `ownerId`.
