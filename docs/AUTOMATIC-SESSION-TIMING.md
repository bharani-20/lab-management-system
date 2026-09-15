# Automatic Session Timing & Lifecycle Specification
**Institution:** Nandha Engineering College  
**Project:** College Computer Lab Management System  

---

## 1. Authoritative Backend Time Generation

### Normal Online Session Start
When a student logs in through the Student Kiosk client:
1. The student submits their Registration Number, Name, Workstation Number, Faculty, and requested Duration (in minutes).
2. The student client **never** specifies or controls the session `startTime`.
3. The backend immediately captures the trusted server date/time upon receiving the request:
   ```javascript
   const startTime = new Date();
   ```
4. If a client attempts to submit an arbitrary `inTime` or `startTime` in the payload, the backend **ignores** it.
5. `expectedEndTime` is calculated automatically on the server:
   ```javascript
   const expectedEndTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
   ```

---

## 2. Normal Online Session End & Windows Shutdown

### Explicit Session End / Electron Shutdown Event
1. When a student clicks "End Lab" or when Electron detects an OS shutdown signal (`before-quit` / `session-ending`), it sends an end session request (`PUT /api/attendance/:sessionId/end` or `PATCH /api/sessions/:id/end`).
2. The backend generates the authoritative `actualEndTime`:
   ```javascript
   const actualEndTime = new Date();
   ```
3. The session status transitions to `COMPLETED`.
4. The workstation status transitions back to `AVAILABLE`.
5. Realtime Socket.IO event `session:ended` is broadcast.

---

## 3. Power Failure / Hard Crash Stale Session Reconciliation

### Background Reconciliation Mechanism
In the event of a sudden power outage, hard power switch cutoff, or OS crash, an exact shutdown signal cannot be transmitted by the client.
1. The workstation sends periodic heartbeats (`POST /api/sessions/heartbeat` or `POST /api/systems/heartbeat`) every 30 seconds to refresh `lastHeartbeatAt`.
2. A background reconciliation job monitors active sessions:
   - If `expectedEndTime <= now` OR `lastHeartbeatAt` has not been updated for > 5 minutes:
     - The session status is transitioned to `EXPIRED` (or `COMPLETED` if within grace period).
     - `actualEndTime` is recorded as the last known heartbeat timestamp (or `expectedEndTime`), ensuring that no false shutdown timestamp is fabricated.
     - The workstation status is returned to `AVAILABLE`.

---

## 4. Offline Synchronization Lifecycle

### Delayed Transmission from Local Storage (`lms_pending_sync`)
1. If LAN connectivity is lost when a student begins or completes a session, the Student Client queues the event in IndexedDB (`lms_pending_sync`).
2. When LAN connectivity is restored, the client posts the batch to `POST /api/sync/sessions`.
3. The backend accepts client-recorded timestamps **only** through this dedicated offline synchronization route.
4. Duplicate submissions are handled idempotently via `localId` matching without creating duplicate database records.
5. If an offline session was active during the disconnected period but the student is already active elsewhere online, the status is safely downgraded to `CONFLICT` to preserve database integrity.

---

## 5. Role-Based Timing Confidentiality Matrix

| User Role | View Start Time | View Expected End Time | View Actual End Time | Control / Modify Timestamps |
|---|---|---|---|---|
| **STUDENT** | ❌ Omitted | ❌ Omitted | ❌ Omitted | ⛔ Forbidden (Backend-generated) |
| **FACULTY** | ❌ Omitted | ❌ Omitted | ❌ Omitted | ⛔ Forbidden |
| **NON_TEACHING_STAFF** | ❌ Omitted | ❌ Omitted | ❌ Omitted | ⛔ Forbidden |
| **ADMIN** | ✅ Visible | ✅ Visible | ✅ Visible | ⛔ Read-Only (System-generated) |
