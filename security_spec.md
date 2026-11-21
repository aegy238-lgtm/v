# Firestore Security Specification (`shosho-chat-3e571` / `ai-studio-remixuntitled-3c04323c-034c-4673-abe5-cac3067587f6`)

## 1. Data Invariants
1. **Identity & Email Verification**: All authenticated mutations require `request.auth != null && request.auth.token.email_verified == true`. Admin access is strictly gated by verified admin email (`hhsiggidfhkgogfc@gmail.com`) or membership in `/admins/{uid}`.
2. **ID Poisoning Guard**: Every single-document path (`get`, `create`, `update`, `delete`) enforces `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, max 128 chars).
3. **Strict Schema & Bounds**: Every string field enforces `.size() <= MAX`, every numeric field is type-checked (`is number`) and non-negative where applicable, and bounded arrays enforce `.size() <= MAX`.
4. **PII & Ledger Isolation**: User accounts (`/users`, `/auravoice_users`), financial transactions (`/auravoice_transactions`), agents (`/auravoice_agents`), staff (`/auravoice_staff`), and activity logs (`/activity_logs`) are never readable by unauthenticated clients.
5. **Admin-Only Catalog Mutations**: Gift definitions, store cosmetic items, staff roster, recharge agents, and platform settings cannot be modified by non-admin users.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Write to Rooms**: `create /auravoice_rooms/room_evil` with `auth == null`.
2. **Unverified Email Spoof as Admin**: `write /auravoice_gifts/gift_evil` with `token.email == "hhsiggidfhkgogfc@gmail.com"` and `email_verified == false`.
3. **ID Poisoning (Oversized / Invalid Doc ID)**: `create /auravoice_rooms/../../evil$id` with invalid characters or length > 128.
4. **Shadow / Ghost Field Injection on User**: `create /users/u1` with `{ id: "u1", name: "x", email: "a@b.com", isSuperAdmin: true }` by non-admin.
5. **Privilege Escalation on Self-Update**: `update /users/u1` changing `role` from `"user"` to `"admin"` by non-admin.
6. **Negative Coins / Value Poisoning**: `update /auravoice_users/u1` setting `coins: -999999` or `coins: "infinite"`.
7. **Unbounded Array Exhaustion**: `create /auravoice_rooms/r1` with `seats` array of length 1000 (> 24).
8. **Oversized String Payload (Denial of Wallet)**: `create /auravoice_rooms/r1/messages/m1` with `text` > 500 chars.
9. **Unauthorized Gift Catalog Tampering**: Non-admin attempting `update /auravoice_gifts/gift_rose` to set `coinPrice: 0`.
10. **Unauthorized Agent Balance Inflation**: Non-admin attempting `update /auravoice_agents/agent_1` to set `balanceCoins: 999999999`.
11. **Unauthenticated PII Read**: Unauthenticated client attempting `get /users/u1` or `list /auravoice_transactions`.
12. **Terminal Status Tampering on Transactions**: Non-admin attempting `update /auravoice_transactions/tx_1` after `status == 'completed'`.
