# Backend Feature Implementation Report: System Identity, Dynamic IP & 21-Day Cleanup

**Execution Date:** 2026-09-15  
**Environment:** Node.js v22.19.0, Express.js, PostgreSQL / Prisma ORM, Jest v29.7.0, Supertest v7.0.0  
**Test Status:** **PASS (100% Passed: 22 Test Suites, 129 Tests)**

---

## 1. Executive Summary

This report documents the implementation and verification of automatic 21-day data retention cleanup, permanent system identification (`PC-01` to `PC-64`), dynamic LAN IP detection and DHCP resilience, duplicate IP collision resolution, and heartbeat online/offline state management.

All features were implemented with non-regression preservation of existing authentication, RBAC, session timing security, offline sync idempotency, reports, and Excel export systems.

---

## 2. Key Architecture & Identity Invariants

1. **`systemCode` is Permanent**:
   - The 64 lab workstations are identified permanently by `systemCode` (`PC-01` through `PC-64`).
   - `systemCode` is unique and immutable across network changes.

2. **IP Address is Dynamic (NOT Permanent Identity)**:
   - IP address is dynamic network metadata (`ipAddress` in Prisma model).
   - Under no circumstances is the IP address treated as a primary key or permanent system identity.

3. **Automatic Backend LAN IP Detection**:
   - The backend automatically extracts and normalizes the source IPv4 address from the incoming HTTP connection.
   - IPv4-mapped IPv6 prefixes (`::ffff:192.168.1.x`) and IPv6 loopbacks (`::1` -> `127.0.0.1`) are normalized automatically.
   - Request source IP is authoritative; client-reported IP is treated as supplementary.

4. **DHCP Change Handling**:
   - If workstation `PC-01` changes IP from `192.168.1.101` to `192.168.1.125` via DHCP, the next authenticated heartbeat updates `PC-01.ipAddress` seamlessly without altering its identity or creating duplicate rows.

5. **Last Known IP Retained Offline**:
   - When a workstation goes `OFFLINE`, its last known IP is retained in the database for administrative visibility and diagnostic tracking.

6. **Duplicate IP Conflict Handling**:
   - If DHCP reassigns an IP (`192.168.1.125`) to `PC-02` while `PC-01` previously held it, the backend logs `[SYSTEM_IP_CONFLICT]`, updates `PC-02`, and clears the stale IP on `PC-01` while preserving both permanent system records.

7. **Protected Master Data during 21-Day Retention Cleanup**:
   - Automated daily cleanup calculates UTC cutoff date (`now - 21 days`).
   - Deletes historical completed/expired sessions and attendances older than the cutoff.
   - Users, Systems (`PC-01` to `PC-64`), Students master records, Timetables, and Active sessions are strictly protected and never deleted.

---

## 3. Files Created and Modified

### Files Created:
- [`src/utils/ipAddress.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/ipAddress.js): Dedicated export alias for IP normalization and extraction utilities.
- [`tests/systems/systemHeartbeatIp.test.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/tests/systems/systemHeartbeatIp.test.js): Concurrency, DHCP transition, IP normalization, and 64-PC heartbeat test suite.
- [`docs/BACKEND-FEATURE-IMPLEMENTATION-REPORT.md`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/docs/BACKEND-FEATURE-IMPLEMENTATION-REPORT.md): Comprehensive implementation report.

### Files Modified:
- [`src/utils/ipHelper.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/utils/ipHelper.js): Added IPv4 regex validation, loopback normalization, IPv4-mapped IPv6 stripping, and authoritative IP extraction.
- [`src/jobs/dataCleanupJob.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/jobs/dataCleanupJob.js): Added UTC cutoff calculation, structured audit logging (`CLEANUP_STARTED`, `CLEANUP_COMPLETED`, `CLEANUP_ERROR`), transactional execution, and master data preservation.
- [`src/services/systemService.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/services/systemService.js): Added `SYSTEM_HEARTBEAT`, `SYSTEM_IP_UPDATED`, `SYSTEM_ONLINE`, `SYSTEM_IP_CONFLICT` logging, lookup by ID or `systemCode`, and duplicate IP collision resolution.
- [`src/services/sessionService.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/src/services/sessionService.js): Added structured logging to session heartbeats and dynamic IP updates.
- [`tests/cleanup/cleanup.test.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/tests/cleanup/cleanup.test.js): Enhanced with exact 21-day cutoff verification, active session retention, and master entity integrity assertions.
- [`tests/setup/testDatabase.js`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/server/tests/setup/testDatabase.js): Added support for `{ not: ... }` and `{ gt: ... }` Prisma filtering in in-memory test store.
- [`docs/API.md`](file:///c:/Users/BHARANI/OneDrive/Desktop/lab%20project/docs/API.md): Documented system identity, dynamic network model, and 21-day retention policy.

---

## 4. Verification & Test Execution Results

```
Test Suites: 22 passed, 22 total
Tests:       129 passed, 129 total
Snapshots:   0 total
Time:        22.438 s
```

### Breakdown of Test Areas Verified:
1. **Health API**: HTTP 200 health check, DB availability, 404 route handling.
2. **Authentication & RBAC**: Admin, Faculty, Staff login, token expiry, 403 Forbidden enforcement on restricted routes.
3. **64-PC Lab Systems (`PC-01` to `PC-64`)**: Integrity of all 64 workstations, uniqueness of `systemCode`, prevention of duplicate codes (HTTP 409).
4. **Automatic IP Detection & DHCP Handling**: Normalization of `::ffff:`, dynamic IP update on DHCP changes, preservation of `systemCode`.
5. **64-PC Concurrency Test**: All 64 workstations (`PC-01` through `PC-64`) sending heartbeats concurrently with distinct IPs — 100% success rate with zero duplicate rows created.
6. **Duplicate IP Conflict Resolution**: Concurrent IP collisions detected, logged (`SYSTEM_IP_CONFLICT`), and resolved safely.
7. **Online / Offline Transitions**: Disconnected systems transition to `OFFLINE` while retaining last known IP; reconnection restores `AVAILABLE` status.
8. **21-Day Retention Cleanup Job**: 22-day historical sessions/attendances deleted; 20-day records and active sessions retained; master data (Users, Systems, Students, Timetables) strictly preserved.
9. **Session Timing Security**: Server-generated `startTime`, backend calculation `expectedEndTime = startTime + durationMinutes`, anti-tampering rejection (HTTP 422), role-based timing sanitization (Admin only).
10. **Offline Sync & Idempotency**: `localId` UUID idempotency prevents duplicate records during batch syncs.
11. **Reports & Excel Export**: Streaming `.xlsx` spreadsheet generation with proper MIME types.

---

## 5. Environment & Database Status
- **Database Migrations Required**: **NO** (Existing Prisma schema already incorporates required models and indexes).
- **Environment Variables**: `CLEANUP_DAYS=21` supported in configuration and documented in `.env.example`.
- **Remaining Issues**: **None**. All requirements and regression rules satisfied.
