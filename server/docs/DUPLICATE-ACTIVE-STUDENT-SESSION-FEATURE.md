# Duplicate Active Student Login Restriction

## Overview

Prevents the same student Registration Number from having more than **ONE ACTIVE lab session** at the same time across all 64 workstations.

This is a backend-enforced constraint. The student client does not need to be modified.

---

## Behavior

### Online Session Start

When a student submits `POST /api/sessions`, the backend:

1. **Normalizes** `registrationNo` → `trim().toUpperCase()`
2. **Checks** if any session with `status = ACTIVE` already exists for that `registrationNo` across any system
3. **Rejects** with `409 CONFLICT` if found

### Concurrency Protection

Inside a `prisma.$transaction`, the active-session check is **re-executed** before creation. This prevents race conditions when two PCs submit the same student's registration simultaneously.

### Offline Sync (`POST /api/sync/sessions`)

When an offline-synced session arrives with `status = ACTIVE`:

- The backend checks if the student already has another active session online
- If **yes** → the session is stored with `status = "CONFLICT"` (not `ACTIVE`) so no duplicate active session is created
- The sync result item will show `result: "conflict"` with an explanatory message

---

## Error Response

**HTTP `409 Conflict`**

```json
{
  "success": false,
  "message": "Invalid User",
  "errorCode": "STUDENT_ALREADY_ACTIVE",
  "error": {
    "code": "STUDENT_ALREADY_ACTIVE",
    "details": {
      "registrationNo": "REG2026001",
      "activeSystemCode": "PC-01",
      "message": "This registration number is already active on another system."
    }
  }
}
```

---

## Normalization Rules

| Input              | Stored As    |
|--------------------|--------------|
| `reg2026001`       | `REG2026001` |
| `  REG2026001  `   | `REG2026001` |
| `Reg2026001`       | `REG2026001` |

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/sessionService.js` | Added `registrationNo` normalization, cross-system active session check, and transactional concurrency re-check in `createSession` |
| `src/services/syncService.js` | Added active-student conflict detection for ACTIVE offline sessions; downgrades to `CONFLICT` status |
| `src/utils/response.js` | Added `errorCode` and `details` fields to `sendError` response body |
| `tests/sessions/duplicateActiveStudent.test.js` | 10 integration test cases for the feature |

---

## Test Cases

| # | Description | Expected |
|---|-------------|----------|
| TC-01 | Same student on different PC | `409 STUDENT_ALREADY_ACTIVE`, `"Invalid User"` |
| TC-02 | Lowercase registrationNo normalization | `409 STUDENT_ALREADY_ACTIVE` |
| TC-03 | Whitespace-padded registrationNo | `409 STUDENT_ALREADY_ACTIVE` |
| TC-04 | Same `localId` submitted twice (idempotency) | `201` with existing session returned |
| TC-05 | New session after first session ends | `201 ACTIVE` |
| TC-06 | Different student on same PC after end | `201 ACTIVE` |
| TC-07 | Two different students simultaneously | Both `201 ACTIVE` |
| TC-08 | Different student on busy PC | `409 SYSTEM_BUSY` |
| TC-09 | Same student on same busy PC | `409 STUDENT_ALREADY_ACTIVE` |
| TC-10 | Offline sync ACTIVE while student active online | Stored as `CONFLICT`, result: `"conflict"` |

---

## Session Status Flow

```
ACTIVE ─────────────────► COMPLETED  (normal end)
ACTIVE ─────────────────► EXPIRED    (time exceeded without end)
ACTIVE (offline sync)   ► CONFLICT   (student already active online)
```

---

## Constraints

- ✅ No schema changes required — uses existing `registrationNoSnapshot` field with `mode: 'insensitive'` Prisma filter
- ✅ No student-app/client changes required
- ✅ No admin dashboard changes required
- ✅ Backward compatible with all existing sessions and tests
