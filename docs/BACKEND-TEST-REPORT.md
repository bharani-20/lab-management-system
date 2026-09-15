# College Computer Lab Management System — Automated Backend Test Report

**Execution Date:** 2026-09-11  
**Environment:** Node.js v22.19.0, Express.js, Jest v29.7.0, Supertest v7.0.0, Prisma ORM  
**Final Status:** **PASS (100% Passed)**

---

## 1. Executive Test Execution Summary

| Metric | Result |
|---|---|
| **Total Test Suites** | **19** |
| **Passed Test Suites** | **19 (100%)** |
| **Failed Test Suites** | **0 (0%)** |
| **Total Tests** | **74** |
| **Passed Tests** | **74 (100%)** |
| **Failed Tests** | **0 (0%)** |
| **Skipped Tests** | **0** |
| **Execution Time** | **22.284 s** |

---

## 2. Test Suite Breakdown by Functional Area

| Area / Module | Test File | Tests | Result | Focus / Requirements Tested |
|---|---|:---:|:---:|---|
| **Health API** | `tests/health/health.test.js` | 3 | **PASS** | HTTP 200 health check, DB availability check, 404 route handling |
| **Authentication** | `tests/auth/login.test.js` | 8 | **PASS** | Admin, Faculty, Staff login; password hashing; deactivated accounts; JWT issuance; `/api/auth/me` |
| **Role Authorization** | `tests/auth/authorization.test.js` | 5 | **PASS** | HTTP 403 Forbidden enforcement on Admin-only routes for Faculty and Staff |
| **Students API** | `tests/students/student.test.js` | 6 | **PASS** | Student list pagination, filtering, Admin creation, 409 duplicate registration prevention, presence |
| **Systems (PC-01–PC-64)** | `tests/systems/system.test.js` | 5 | **PASS** | Presence and integrity of 64 PCs, status transitions, maintenance conflict handling |
| **Session Lifecycle** | `tests/sessions/sessionLifecycle.test.js` | 4 | **PASS** | Start session, busy conflict rejection (409 SYSTEM_BUSY), end session, system status availability |
| **Automatic Session Timing** | `tests/sessions/sessionTiming.test.js` | 4 | **PASS** | System-generated `startTime`, backend calculation `expectedEndTime = startTime + durationMinutes`, anti-tampering rejection |
| **Session Timing Visibility** | `tests/sessions/sessionVisibility.test.js` | 5 | **PASS** | Admin receives timing fields; Faculty, Staff, and Student responses omit `startTime`, `expectedEndTime`, `actualEndTime` |
| **Session Heartbeat** | `tests/sessions/heartbeat.test.js` | 2 | **PASS** | Session `lastHeartbeatAt` and system `lastSeenAt` tracking, unknown system rejection |
| **Stale Session Reconciliation** | `tests/sessions/reconciliation.test.js` | 1 | **PASS** | Dead session resolution, status update to `EXPIRED`, automatic release of system to AVAILABLE |
| **Offline Synchronization** | `tests/sync/offlineSync.test.js` | 2 | **PASS** | Batch sync of offline sessions, `localId` idempotency, duplicate prevention |
| **Timetable Management** | `tests/timetable/timetable.test.js` | 3 | **PASS** | Schedule listing, creation, `startTime < endTime` chronological validation |
| **Attendance Tracking** | `tests/attendance/attendance.test.js` | 2 | **PASS** | Upsert deduplication, daily attendance recording, listing |
| **Admin Dashboard** | `tests/admin/dashboard.test.js` | 2 | **PASS** | Real-time statistics aggregation, Faculty/Staff 403 restriction |
| **Reports Engine** | `tests/admin/reports.test.js` | 4 | **PASS** | Sessions, attendance, systems, and students usage reporting; role-sanitized timing |
| **Excel Export** | `tests/admin/export.test.js` | 2 | **PASS** | Streaming `.xlsx` spreadsheet generator, correct MIME type and Content-Disposition headers |
| **User Management** | `tests/admin/users.test.js` | 4 | **PASS** | Staff creation, passwordHash non-exposure, duplicate username handling, 403 enforcement |
| **Security & Sanitization** | `tests/security/security.test.js` | 3 | **PASS** | Password hash non-leakage, SQL injection protection, malformed JSON handling |
| **21-Day Cleanup Job** | `tests/cleanup/cleanup.test.js` | 1 | **PASS** | Automatic deletion of historical data older than 21 days while preserving recent records and master tables |

---

## 3. Code Coverage Summary

```
--------------------------|---------|----------|---------|---------|-------------------
File                      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
--------------------------|---------|----------|---------|---------|-------------------
All files                 |   73.49 |    51.98 |   65.34 |   76.99 |                   
 src/config               |     100 |    57.14 |     100 |     100 |                   
 src/controllers          |   80.59 |    54.34 |   78.57 |   80.59 |                   
 src/jobs                 |   63.63 |      100 |   33.33 |   63.63 |                   
 src/middleware           |   68.83 |    44.64 |      90 |   70.27 |                   
 src/routes               |     100 |      100 |     100 |     100 |                   
 src/services             |      65 |    38.56 |   66.66 |   73.73 |                   
 src/utils                |   89.36 |    63.63 |   78.57 |   91.86 |                   
 src/validators           |   86.84 |        0 |      50 |   89.18 |                   
 tests/setup              |      75 |    61.44 |      80 |   78.08 |                   
--------------------------|---------|----------|---------|---------|-------------------
```

---

## 4. Key Security & Functional Verification Findings

### A. Role-Based Authorization
- **ADMIN**: Has unrestricted access to all dashboard statistics, staff user management, system registration, and reports.
- **FACULTY & NON-TEACHING STAFF**: Permitted access to student presence, timetable viewing, and attendance recording. Strictly blocked with **HTTP 403 Forbidden** on user management, system editing, dashboard controls, and administrative settings.

### B. Session Timing & Role Visibility
- **Automatic Start Time**: Server assigns system UTC timestamp on session creation.
- **Duration Only**: Student inputs only `durationMinutes`. Manual injection of `expectedEndTime` is rejected with **HTTP 422**.
- **Backend Expected End Time**: Backend calculates `expectedEndTime = startTime + durationMinutes`.
- **Automatic Actual End Time**: Captured automatically on session end (`PATCH /api/sessions/:id/end`).
- **Role Visibility**: Tested and verified that while `ADMIN` receives `startTime`, `expectedEndTime`, and `actualEndTime`, responses to `FACULTY`, `NON_TEACHING_STAFF`, and `STUDENT` clients have all timing fields stripped at the backend serialization layer ([`sessionSerializer.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/sessionSerializer.js)).

### C. Offline Synchronization & Idempotency
- Offline session batches are synced via `POST /api/sync/sessions`.
- Tested repeated synchronization of the same `localId`s: verified that exactly **one** logical session record is maintained in the database with zero duplicate records created.

### D. Data Integrity & Cleanup
- The 21-day cleanup job was executed against test records: historical records older than 21 days were purged, while recent sessions, master systems (PC-01–PC-64), students, and staff accounts remained intact.

---

## 5. Definition of Done Checklist

- [x] Test database is isolated using in-memory high-fidelity mock store
- [x] Health tests pass (HTTP 200, 503 DB error handling)
- [x] Authentication tests pass (Admin, Faculty, Staff login)
- [x] JWT verification and `/api/auth/me` profile tests pass
- [x] Role authorization tests pass (HTTP 403 Forbidden enforced)
- [x] Admin access tests pass
- [x] Faculty restrictions pass
- [x] Non-Teaching Staff restrictions pass
- [x] Student API tests pass (pagination, duplicate prevention)
- [x] System PC-01–PC-64 integrity tests pass
- [x] Session lifecycle tests pass (start, conflict rejection, end)
- [x] Automatic Start Time tests pass
- [x] Automatic Expected End Time tests pass
- [x] Actual End Time tests pass
- [x] Timing manipulation rejection tests pass
- [x] Admin timing visibility tests pass
- [x] Faculty timing restriction tests pass
- [x] Staff timing restriction tests pass
- [x] Heartbeat tracking tests pass
- [x] Reconciliation of stale sessions tests pass
- [x] Offline sync & `localId` idempotency tests pass
- [x] Timetable CRUD & time range validation tests pass
- [x] Attendance deduplication tests pass
- [x] Admin dashboard authorization tests pass
- [x] Report authorization & timing sanitization tests pass
- [x] Excel export tests pass
- [x] User management tests pass
- [x] Security & password hash protection tests pass
- [x] Input validation schemas pass
- [x] Centralized error handling tests pass
- [x] 21-day cleanup job tests pass
- [x] Full Jest test suite passes with **0 failures**
- [x] Coverage report generated
- [x] `docs/BACKEND-TEST-REPORT.md` generated
