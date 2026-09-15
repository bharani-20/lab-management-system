# College Computer Lab Management System — API Specification & Contract

## Overview

This document specifies the REST API endpoints, system identity policies, dynamic IP management, data security contracts, and automatic retention policies for the College Computer Lab Management System backend.

---

## 1. System Identity & Dynamic Network Contract

### 64 Lab Workstations (`PC-01` to `PC-64`)
- **Permanent Identity (`systemCode`)**: Logical systems `PC-01` through `PC-64` represent the permanent workstation identity.
- **Dynamic Network Information (`currentIp` / `ipAddress`)**: The system IP is dynamic (DHCP-assigned) and is **never** used as the permanent database identity.
- **DHCP Transition Resilience**: If a machine’s IP changes from `192.168.1.101` to `192.168.1.125`, the backend updates `ipAddress` automatically on the next heartbeat without altering `systemCode` or generating duplicate system rows.
- **Offline IP Preservation**: When a system goes `OFFLINE`, its last known IP address is preserved for administrative diagnostic visibility.
- **Duplicate IP Conflict Handling**: If two systems report the same IP concurrently due to DHCP pool reassignment, both permanent `systemCode` records remain intact, a `SYSTEM_IP_CONFLICT` warning is logged, and the IP is reassigned to the latest reporting system while clearing the collision on the previous owner.

---

## 2. Session Timing & Security Contract

### Field Classification

| Field | Source / Origin | Student Visible | Admin Visible | Faculty & Non-Teaching Staff | Direct Modification via API |
|---|---|---|---|---|---|
| `durationMinutes` | **Student-provided** (input in minutes) | ✅ Visible | ✅ Visible | ✅ Visible | Student sends upon starting session |
| `startTime` | **System-generated** (Captured Windows local date/time in UTC) | ❌ **Hidden** | ✅ Visible | ❌ **Restricted (Omitted by Backend)** | ⛔ Forbidden — System generated only |
| `expectedEndTime` | **System-calculated** (`startTime` + `durationMinutes`) | ❌ **Hidden** | ✅ Visible | ❌ **Restricted (Omitted by Backend)** | ⛔ Forbidden — System calculated only |
| `actualEndTime` | **System-captured** (Captured on completion, shutdown sync, or heartbeat timeout) | ❌ **Hidden** | ✅ Visible | ❌ **Restricted (Omitted by Backend)** | ⛔ Forbidden — System captured only |
| `localId` | **Client UUID** (Idempotency Key) | Internal | ✅ Visible | ✅ Visible | Sent by Student Client for offline idempotency |
| `systemCode` | **System identifier** (e.g. `PC-01` ... `PC-64`) | ✅ Visible | ✅ Visible | ✅ Visible | Provided by Student Client machine context |

---

## 3. Automatic 21-Day Data Retention Policy

- **Environment Config**: `CLEANUP_DAYS=21` (default: 21 days).
- **Schedule**: Automatically runs daily at 02:00 AM UTC.
- **Cutoff Calculation**: `cutoff = current_utc_time - CLEANUP_DAYS`.
- **Target Deletions**: Historical completed/expired sessions (`startTime < cutoff`) and attendance logs (`createdAt < cutoff`).
- **Protected Master Data**: Users, Systems `PC-01` to `PC-64`, Students master records, and Timetables are strictly preserved and never deleted by the retention job.

---

## 4. API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /api/auth/login`: Authenticate staff/admin user (Rate limited 10 req/15min). Returns JWT.
- `GET /api/auth/me`: Get current logged-in user profile.

### Systems & Heartbeat (`/api/systems`)
- `POST /api/systems/heartbeat`: Workstation heartbeat ping. Automatically detects source LAN IP, normalizes IPv4-mapped IPv6, updates `ipAddress`, `lastSeenAt`, and sets status to `AVAILABLE` (if previously `OFFLINE`).
- `GET /api/systems`: List lab computer systems and current status.
- `GET /api/systems/:id`: Get system details (accepts DB ID or `systemCode` e.g. `PC-01`).
- `POST /api/systems`: Register new computer (Admin only).
- `PUT /api/systems/:id`: Update system info / status (Admin only).
- `DELETE /api/systems/:id`: Delete computer (Admin only).

### Sessions (`/api/sessions`)
- `POST /api/sessions`: Start new lab session. (System captures `startTime`, calculates `expectedEndTime`).
- `PATCH /api/sessions/:id/end`: End active lab session. (System captures `actualEndTime`).
- `POST /api/sessions/heartbeat`: Heartbeat ping to keep session active and detect power-loss/stale sessions.
- `POST /api/sessions/reconcile`: Admin trigger to reconcile stale/power-off sessions.
- `GET /api/sessions`: List sessions with filters and pagination. (Role-sanitized).
- `GET /api/sessions/:id`: Get single session. (Role-sanitized).

### Offline Synchronization (`/api/sync`)
- `POST /api/sync/sessions`: Batch sync offline sessions saved in IndexedDB using `localId` idempotency.

### Students & Presence (`/api/students`)
- `GET /api/students/presence`: Real-time student presence grid. (Role-sanitized: timing omitted for Faculty/Staff).
- `GET /api/students`: List students with filters.
- `GET /api/students/:id`: Get student profile.
- `POST /api/students`: Create student (Admin only).
- `PUT /api/students/:id`: Update student details (Admin only).
- `DELETE /api/students/:id`: Delete student (Admin only).

### Timetable (`/api/timetable`)
- `GET /api/timetable`: List timetable class schedules.
- `GET /api/timetable/:id`: Get timetable entry.
- `POST /api/timetable`: Create timetable entry (Admin only).
- `PUT /api/timetable/:id`: Update timetable entry (Admin only).
- `DELETE /api/timetable/:id`: Delete timetable entry (Admin only).

### Attendance & Student Kiosk Session (`/api/attendance`)
- `GET /api/attendance`: List attendance records (Admin, Faculty, Non-Teaching Staff).
- `POST /api/attendance`: 
  - **Student Kiosk Mode (No JWT)**: Accepts `registerNumber`, `studentName`, `systemNumber`, `faculty`, `sessionId`, `duration`. Starts lab session, enforces single-active-session restriction (409 `Invalid User`), captures server-clock `startTime`, and records attendance.
  - **Admin/Faculty Mode (With JWT)**: Records manual attendance entry with `studentId`, `date`, `status`.
- `PUT /api/attendance/:sessionId/end` or `POST /api/attendance/end`: End active session from student kiosk using `sessionId`.

### Workstation & System Info (`/api/system` & `/api/systems`)
- `GET /api/system/info`: Kiosk polling endpoint. Accepts `systemCode` (e.g. `PC-05` or `LAB1-PC05`) or automatically detects client workstation IP. Returns workstation state, active session, and server clock timestamp.
- `GET /api/systems/info`: Alias of `GET /api/system/info`.

### Faculty (`/api/faculty`)
- `GET /api/faculty`: Public endpoint providing faculty list (`Dr. D. Sathya`, `Ms. C. Vasuki`, etc.) for student client dropdowns.

### Labs (`/api/labs`)
- `GET /api/labs`: Public endpoint providing list of college computer laboratories and workstation capacities.

### Tickets & Issue Reporting (`/api/tickets`)
- `POST /api/tickets`: Public student kiosk problem reporting endpoint (`category`, `description`, `systemNumber`, `studentName`, `registerNumber`).
- `GET /api/tickets`: List submitted support tickets with filtering by status and system (Admin, Faculty, Staff).
- `GET /api/tickets/:id`: Get ticket details.
- `PATCH /api/tickets/:id/status`: Update ticket resolution status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`).

### User Management (`/api/users`) — Admin Only
- `GET /api/users`: List administrative staff accounts.
- `GET /api/users/:id`: Get staff user details.
- `POST /api/users`: Create staff account.
- `PUT /api/users/:id`: Update user role / status / password.
- `DELETE /api/users/:id`: Delete staff user.

### Reports (`/api/reports`)
- `GET /api/reports/sessions`: Sessions history report (Role-sanitized).
- `GET /api/reports/attendance`: Attendance summary report.
- `GET /api/reports/systems`: System utilization report.
- `GET /api/reports/students`: Student lab usage report.

### Export (`/api/export`)
- `GET /api/export/sessions`: Export session records to styled Excel (`.xlsx`) spreadsheet.

### Dashboard (`/api/dashboard`) — Admin Only
- `GET /api/dashboard/stats`: Overview counter statistics (Active sessions, systems status, today total).

### System Health (`/api`)
- `GET /api/health`: Health status endpoint.
