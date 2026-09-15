# Automatic Session Timing

## Overview

All session timing is generated and controlled exclusively by the **backend server**.  
Students cannot submit, modify, or influence any timing field.

---

## 1. Start Time Generation

### Online Session

When `POST /api/sessions` is received and the session is **successfully created**:

```js
const startTime = new Date();  // Backend server clock at session creation
```

- `startTime` is captured **at the moment of session creation** inside the database transaction
- It is **not** captured when the student opens the form
- It is **not** captured when the application starts
- The client **cannot** supply `startTime` in the request body — the schema will reject it with `422`

### Client Tamper Attempt

```http
POST /api/sessions
{
  "startTime": "2020-01-01T10:00:00Z"   ← REJECTED
}
→ 422 Unprocessable Entity
```

The `createSessionSchema` uses `.strict()` — any unknown field (including `startTime`) is rejected.

---

## 2. Expected End Time

```
expectedEndTime = startTime + durationMinutes
```

Calculated by the backend immediately after `startTime` is set:

```js
const expectedEndTime = calculateExpectedEndTime(startTime, durationMinutes);
// e.g. 14:15 + 60 min = 15:15
```

- The client **cannot** supply `expectedEndTime` — also rejected by `.strict()` schema
- The formula runs on the backend; frontend cannot control it

---

## 3. Actual End Time

### Normal End (Student ends session)

```http
PATCH /api/sessions/:id/end
```

```js
const actualEndTime = new Date();  // Backend server clock at end moment
```

### Crash / Power Failure

Handled by the existing reconciliation cron job:

```js
const calculatedEndTime = session.lastHeartbeatAt || session.expectedEndTime;
```

The cron runs every minute and resolves stale active sessions.

### Windows Shutdown

Electron sends a shutdown event → backend records `actualEndTime = new Date()` at receipt time.

---

## 4. Offline Session Behavior

If the student client **cannot reach the backend** when starting a session:

1. Client records local system time as `startTime` and stores session locally
2. Session is marked for sync later
3. When connectivity is restored, `POST /api/sync/sessions` is called
4. The backend **accepts** the client-provided `startTime` from the sync payload
5. The session is stored with `syncSource = "OFFLINE_SYNC"`

```
syncSessionSchema allows:  startTime (required ISO 8601)
createSessionSchema allows: startTime → NOT ACCEPTED (strict rejection)
```

### Offline Sync Flow

```
PC offline → local startTime captured → sync later
     ↓
POST /api/sync/sessions
{ startTime: "2026-09-15T08:00:00Z", ... }  ← ACCEPTED for sync only
     ↓
Stored with syncSource = OFFLINE_SYNC
```

---

## 5. Timestamp Security

| Attack Vector | Defense |
|---|---|
| Client sends `startTime` in online request | `.strict()` schema rejects → `422` |
| Client sends `expectedEndTime` | `.strict()` schema rejects → `422` |
| Client sends `actualEndTime` | `.strict()` schema rejects → `422` |
| Offline sync abused as online | Different routes, `syncSource` tagged |
| Backdated offline `startTime` | Accepted (server was unavailable; cannot verify) |

---

## 6. Role-Based Timing Visibility

Enforced at the **backend response-serialization layer** (`sessionSerializer.js`).  
Frontend hiding is **not relied upon**.

| Role | `startTime` | `expectedEndTime` | `actualEndTime` | `lastHeartbeatAt` |
|------|:-----------:|:-----------------:|:---------------:|:-----------------:|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| FACULTY | ❌ | ❌ | ❌ | ❌ |
| NON_TEACHING_STAFF | ❌ | ❌ | ❌ | ❌ |
| STUDENT (client) | ❌ | ❌ | ❌ | ❌ |

---

## 7. Complete Online Timing Flow

```
Student clicks "Start Lab"
        ↓
POST /api/sessions (no startTime in body)
        ↓
Schema validates (strict — startTime not allowed)
        ↓
Duplicate active registration check
        ↓
Transaction begins
        ↓
startTime = new Date()          ← Backend server clock
expectedEndTime = startTime + durationMinutes
        ↓
Session created (status = ACTIVE)
        ↓
Student uses PC (heartbeats every N seconds)
        ↓
Windows shutdown
        ↓
Electron sends shutdown event
        ↓
PATCH /api/sessions/:id/end
        ↓
actualEndTime = new Date()      ← Backend server clock
        ↓
Session → COMPLETED
System → AVAILABLE
```

---

## 8. Files Changed

| File | Change |
|------|--------|
| `src/validators/sessionValidator.js` | Removed `startTime` from `createSessionSchema`; updated `.strict()` message |
| `src/services/sessionService.js` | Removed `clientStartTime` from destructuring; always use `new Date()` as `startTime` |
| `tests/sessions/sessionTiming.test.js` | Extended with 9 new test cases (TC-T1 through TC-T9) |
| `docs/AUTOMATIC-SESSION-TIMING.md` | This document |

---

## 9. Test Results

| Test | Description | Result |
|------|-------------|--------|
| TC-T1 | Backend-generated `startTime` within test window | ✅ PASS |
| TC-T2 | Client-sent `startTime` rejected → `422` | ✅ PASS |
| TC-T3 | `expectedEndTime = startTime + durationMinutes` | ✅ PASS |
| TC-T4 | `startTime` generated at creation, not before | ✅ PASS |
| TC-T5 | Offline sync preserves client `startTime` | ✅ PASS |
| TC-T6 | `startTime` only via sync route, not online | ✅ PASS |
| TC-T7 | Duplicate active registration still protected | ✅ PASS |
| TC-T8 | `actualEndTime` = backend clock at end | ✅ PASS |
| TC-T9 | ADMIN sees timing; FACULTY/STAFF don't | ✅ PASS |
