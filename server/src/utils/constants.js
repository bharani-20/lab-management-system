'use strict';

// ─── Roles ────────────────────────────────────────────────────────────────────

const ROLES = {
  ADMIN: 'ADMIN',
  FACULTY: 'FACULTY',
  NON_TEACHING_STAFF: 'NON_TEACHING_STAFF',
};

// ─── Permissions ──────────────────────────────────────────────────────────────

const PERMISSIONS = {
  VIEW_STUDENT_PRESENCE: 'VIEW_STUDENT_PRESENCE',
  VIEW_STUDENT_DETAILS: 'VIEW_STUDENT_DETAILS',

  VIEW_TIMETABLE: 'VIEW_TIMETABLE',
  CREATE_TIMETABLE: 'CREATE_TIMETABLE',
  UPDATE_TIMETABLE: 'UPDATE_TIMETABLE',
  DELETE_TIMETABLE: 'DELETE_TIMETABLE',

  VIEW_DASHBOARD: 'VIEW_DASHBOARD',

  VIEW_SYSTEMS: 'VIEW_SYSTEMS',
  MANAGE_SYSTEMS: 'MANAGE_SYSTEMS',

  VIEW_ATTENDANCE: 'VIEW_ATTENDANCE',

  MANAGE_USERS: 'MANAGE_USERS',

  VIEW_REPORTS: 'VIEW_REPORTS',
  EXPORT_REPORTS: 'EXPORT_REPORTS',

  MANAGE_SETTINGS: 'MANAGE_SETTINGS',

  SYNC_SESSIONS: 'SYNC_SESSIONS',

  ADMIN_ACCESS: 'ADMIN_ACCESS',
};

// ─── Role → Permission mapping ────────────────────────────────────────────────

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ALL_PERMISSIONS,

  [ROLES.FACULTY]: [
    PERMISSIONS.VIEW_STUDENT_PRESENCE,
    PERMISSIONS.VIEW_STUDENT_DETAILS,
    PERMISSIONS.VIEW_TIMETABLE,
    PERMISSIONS.CREATE_TIMETABLE,
    PERMISSIONS.UPDATE_TIMETABLE,
    PERMISSIONS.DELETE_TIMETABLE,
  ],

  [ROLES.NON_TEACHING_STAFF]: [
    PERMISSIONS.VIEW_STUDENT_PRESENCE,
    PERMISSIONS.VIEW_STUDENT_DETAILS,
    PERMISSIONS.VIEW_TIMETABLE,
    PERMISSIONS.CREATE_TIMETABLE,
    PERMISSIONS.UPDATE_TIMETABLE,
    PERMISSIONS.DELETE_TIMETABLE,
  ],
};

// ─── System Statuses ──────────────────────────────────────────────────────────

const SYSTEM_STATUS = {
  AVAILABLE: 'AVAILABLE',
  ACTIVE: 'ACTIVE',
  OFFLINE: 'OFFLINE',
  MAINTENANCE: 'MAINTENANCE',
};

// ─── Session Statuses ─────────────────────────────────────────────────────────

const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

// ─── Sync Sources ─────────────────────────────────────────────────────────────

const SYNC_SOURCE = {
  ONLINE: 'ONLINE',
  OFFLINE_SYNC: 'OFFLINE_SYNC',
};

// ─── Attendance Statuses ──────────────────────────────────────────────────────

const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
};

// ─── Days of week ─────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

// ─── PC Range ─────────────────────────────────────────────────────────────────

const PC_COUNT = 64;
const PC_PREFIX = 'PC';

// ─── Faculty Members ─────────────────────────────────────────────────────────

const FACULTY_MEMBERS = [
  'Dr. D. Sathya',
  'Ms. C. Vasuki',
  'Ms. Suguna Angamuthu',
  'Ms. D. Kiruthika',
  'Ms. S. Thangamani',
  'Ms. A. Bharathi',
  'Mr. D. Prabhakaran',
  'Ms. R. Saranya',
  'Mr. R. Ragunath',
  'Mr. T. Sanjai',
  'Mr. R. Anand',
  'Ms. P. Vasundradevi',
  'Ms. S. Renuka',
  'Ms. P. Sindhu',
];

module.exports = {
  ROLES,
  USER_ROLE: ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  SYSTEM_STATUS,
  SESSION_STATUS,
  SYNC_SOURCE,
  ATTENDANCE_STATUS,
  DAYS_OF_WEEK,
  PC_COUNT,
  PC_PREFIX,
  FACULTY_MEMBERS,
};
