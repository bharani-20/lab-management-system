# Backend Implementation Report: Start Lab Session, System Identity, Dynamic IP & 21-Day Cleanup

**Execution Date:** 2026-09-15  
**Environment:** Node.js v22.19.0, Express.js, PostgreSQL / Prisma ORM, Jest v29.7.0, Supertest v7.0.0  
**Final Status:** **PASS (100% Passed: 22 Test Suites, 129 Tests)**

---

## 1. Summary
This report documents the backend enhancements for the **College Computer Lab Management System**, covering permanent lab workstation identification (`PC-01` to `PC-64`), dynamic LAN IP detection and DHCP resilience, duplicate IP conflict handling, Start Lab session creation with server-generated timestamps, faculty data support, role-based timing visibility, and automated 21-day data retention cleanup.

---

## 2. Existing Functionality Discovered
- **Database Models**: Prisma schema with `User`, `Student`, `System`, `Session`, `Timetable`, and `Attendance`.
- **RBAC Engine**: Roles for `ADMIN`, `FACULTY`, and `NON_TEACHING_STAFF` with token authentication (`authMiddleware.js`) and role checks (`roleMiddleware.js`).
- **Timing Sanitization**: `sessionSerializer.js` strips `startTime`, `expectedEndTime`, and `actualEndTime` from responses sent to non-admin roles (`FACULTY`, `NON_TEACHING_STAFF`, `STUDENT`).
- **Offline Batch Sync**: `syncService.js` with `localId` UUID idempotency for offline session synchronization.
- **Reporting & Excel Export**: `reportService.js` and `exportService.js` using `exceljs`.

---

## 3. New Functionality Implemented
- **Standard Faculty Constants**: Defined 14 official department faculty members in [`src/utils/constants.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/constants.js).
- **Start Lab Session API**: Updated [`sessionValidator.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/validators/sessionValidator.js) and [`sessionService.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/services/sessionService.js) to accept optional `faculty` while strictly generating `startTime` server-side and calculating `expectedEndTime = startTime + durationMinutes`.
- **Dynamic LAN IP Detection & Normalization**: Created [`src/utils/ipAddress.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/ipAddress.js) and enhanced [`src/utils/ipHelper.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/ipHelper.js) to normalize IPv4-mapped IPv6 (`::ffff:192.168.1.x`) and map IPv6 loopbacks (`::1` -> `127.0.0.1`).
- **DHCP Resilience & Conflict Logging**: Updated [`src/services/systemService.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/services/systemService.js) with structured logs: `SYSTEM_HEARTBEAT`, `SYSTEM_IP_UPDATED`, `SYSTEM_ONLINE`, `SYSTEM_OFFLINE`, `SYSTEM_IP_CONFLICT`.
- **21-Day Retention Cleanup**: Daily cron job in [`src/jobs/dataCleanupJob.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/jobs/dataCleanupJob.js) with UTC cutoff calculation, FK-safe deletions, master entity protection, and structured logging.

---

## 4. Files Modified & Created

### Files Created:
- [`src/utils/ipAddress.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/ipAddress.js)
- [`tests/systems/systemHeartbeatIp.test.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/tests/systems/systemHeartbeatIp.test.js)
- [`docs/BACKEND-START-LAB-SYSTEM-IP-CLEANUP-REPORT.md`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/docs/BACKEND-START-LAB-SYSTEM-IP-CLEANUP-REPORT.md)

### Files Modified:
- [`src/utils/constants.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/constants.js)
- [`src/utils/ipHelper.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/ipHelper.js)
- [`src/validators/sessionValidator.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/validators/sessionValidator.js)
- [`src/services/sessionService.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/services/sessionService.js)
- [`src/services/systemService.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/services/systemService.js)
- [`src/jobs/dataCleanupJob.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/jobs/dataCleanupJob.js)
- [`tests/cleanup/cleanup.test.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/tests/cleanup/cleanup.test.js)
- [`tests/setup/testDatabase.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/tests/setup/testDatabase.js)
- [`docs/API.md`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/docs/API.md)

---

## 5. Database Changes & Migration Status
- **Database Migration Required**: **NO** (The Prisma schema already accommodates all required entities, relations, and fields).

---

## 6. System Identity, Dynamic IP & Network Invariants

1. **`systemCode` is Permanent**:
   - `PC-01` through `PC-64` represent the permanent logical workstations.
   - The permanent identity is immutable across network reconfigurations.

2. **IP is Dynamic Network Information (NOT Identity)**:
   - IP address is dynamic metadata and is never used as a database primary key or permanent identity.

3. **Backend Determines Request Source IP**:
   - Backend extracts source IP automatically from the socket/request (`req.socket.remoteAddress` / `req.ip`).
   - Normalizes IPv4-mapped IPv6 (`::ffff:192.168.1.101` -> `192.168.1.101`).

4. **DHCP Changes Do Not Change PC Identity**:
   - When workstation `PC-01` gets a new DHCP address (e.g. `192.168.1.125`), the next heartbeat updates `PC-01.ipAddress` without altering `systemCode` or creating duplicate rows.

5. **Last Known IP Retained Offline**:
   - When a system becomes `OFFLINE`, its last known IP remains stored in the database for administrative diagnostic visibility.

6. **Duplicate IP Conflict Resolution**:
   - If an IP collision occurs (two systems reporting the same IP), the backend logs `SYSTEM_IP_CONFLICT`, assigns the IP to the active system, and clears the collision on the previous owner while preserving both permanent system records.

---

## 7. Session Timing & Security Contracts

- **Server-Generated `startTime`**: System UTC timestamp captured by the server upon session start.
- **Backend Calculated `expectedEndTime`**: Computed server-side as `startTime + durationMinutes`. Manual injection of `expectedEndTime` or `actualEndTime` is rejected (HTTP 422).
- **Automatic `actualEndTime`**: Captured automatically upon session completion (`PATCH /api/sessions/:id/end`).
- **Role-Based Visibility**: Exact timing fields (`startTime`, `expectedEndTime`, `actualEndTime`) are strictly restricted to `ADMIN` and stripped for `FACULTY`, `NON_TEACHING_STAFF`, and `STUDENT` contexts.

---

## 8. Faculty Data Handling

Standard faculty list defined in constants:
1. Dr. D. Sathya
2. Ms. C. Vasuki
3. Ms. Suguna Angamuthu
4. Ms. D. Kiruthika
5. Ms. S. Thangamani
6. Ms. A. Bharathi
7. Mr. D. Prabhakaran
8. Ms. R. Saranya
9. Mr. R. Ragunath
10. Mr. T. Sanjai
11. Mr. R. Anand
12. Ms. P. Vasundradevi
13. Ms. S. Renuka
14. Ms. P. Sindhu

---

## 9. 21-Day Retention Cleanup Policy

- **Cutoff Calculation**: `cutoff = current_utc_time - 21 days`.
- **Target Deletions**: Historical completed/expired sessions and attendances older than 21 days.
- **Master Data Preservation**: Master records (`User`, `Student`, `System` `PC-01` to `PC-64`, `Timetable`, and Active sessions) are strictly protected and never deleted.
- **Audit Logging**: Logs `CLEANUP_STARTED`, `CLEANUP_COMPLETED`, and `CLEANUP_ERROR`.

---

## 10. Verification & Test Results

```
Test Suites: 22 passed, 22 total
Tests:       129 passed, 129 total
Snapshots:   0 total
Time:        29.942 s
```

- **64-PC Concurrent Heartbeat**: All 64 systems (`PC-01` to `PC-64`) sent heartbeats simultaneously; all succeeded and exactly 64 system rows were maintained.
- **DHCP Transitions**: `PC-01` transitioned from `192.168.1.101` to `192.168.1.125` without duplicate records or identity corruption.
- **Duplicate IP Conflict**: Verified collision detection between `PC-01` and `PC-02` on `192.168.1.125`.
- **Offline/Reconnect**: Last known IP retained while offline; restored to `AVAILABLE` upon reconnection.
- **21-Day Cleanup**: 22-day historical sessions purged; 20-day records and active sessions retained; master data preserved.

---

## 11. Known Limitations
- Sudden ungraceful power loss on a client PC may prevent sending an immediate completion packet; in such cases, the existing backend stale session reconciliation (`reconcileStaleSessions`) uses the last heartbeat timestamp.
