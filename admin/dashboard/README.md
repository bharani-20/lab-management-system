# Lab Management System — Admin Portal

The **Admin Portal** is a management console built for college laboratory administrators, professors/faculty incharge, and lab staff. It provides full oversight over laboratory hardware status, active student sessions, attendance logging, course timetable matrix scheduling, and analytics reports.

---

## 🛠️ Technology Stack

- **Framework**: React 18 (Hooks & Context API)
- **Styling**: Tailwind CSS v3 + CSS Variables Theme System + Dark Mode
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Build Tool**: Vite

---

## 📁 Folder Structure

```
admin/dashboard/
├── public/
│   ├── icons/
│   └── assets/
├── src/
│   ├── assets/
│   ├── auth/              # AuthContext, authService, roleService, permissions
│   ├── components/
│   │   ├── layout/        # Collapsible Sidebar, Navbar, PageContainer, RoleBadge
│   │   ├── common/        # Button, Modal, Drawer, SearchBar, FilterBar, Pagination, Toast, etc.
│   │   ├── dashboard/     # StatCard, SystemOverview, ActiveSessions, RecentEntries
│   │   ├── systems/       # SystemCard, SystemGrid, SystemDetails
│   │   ├── students/      # StudentTable, StudentDetails, StudentFilters
│   │   ├── attendance/    # AttendanceTable, AttendanceSummary, AttendanceFilters
│   │   ├── timetable/     # Timetable, TimetableTable, TimetableForm, TimetableEditor, TimetableFilters
│   │   ├── reports/       # ReportTable, ReportFilters, ExportButton
│   │   └── admin/         # UserTable, UserForm, RoleManagement, PermissionManagement
│   ├── pages/
│   │   ├── auth/          # Login, Unauthorized, ForgotPassword
│   │   ├── admin/         # AdminDashboard, SystemManagement, StudentManagement, AttendanceManagement, TimetableManagement, Reports, UserManagement, Settings
│   │   ├── faculty/       # FacultyDashboard, StudentPresence, Timetable
│   │   └── staff/         # StaffDashboard, StudentPresence, Timetable
│   ├── routes/            # AppRoutes, ProtectedRoute, RoleRoute, routeConfig
│   ├── services/          # api.js, authApi, studentApi, attendanceApi, timetableApi, systemApi, reportApi, socket.js
│   ├── hooks/             # useAuth, useRole, usePermissions, useDashboard, useTimetable
│   ├── utils/             # formatDate, formatTime, constants, helpers
│   ├── App.jsx            # Layout coordinator & route switch
│   ├── main.jsx           # React DOM root
│   └── index.css          # Tailwind & custom CSS tokens
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

The portal runs on `http://localhost:5174`.

### 3. Build for Production
```bash
npm run build
```

---

## 🔐 Role-Based Access

The demo supports 3 instant profiles via the login switcher:
1. **Admin** (`admin@college.edu`): Unrestricted access across dashboard, hardware terminals, student directory, attendance overrides, timetable management, reports, and security settings.
2. **Faculty** (`priya@college.edu`): Access to course dashboards, active batch presence logs, and class timetable slots.
3. **Staff** (`staff@college.edu`): Access to live occupant monitoring, hardware maintenance toggles, and lab room schedule.
