'use strict';

const { signToken } = require('../../src/utils/jwt');
const { ROLES, SYSTEM_STATUS } = require('../../src/utils/constants');

const testUsers = [
  {
    id: 'usr-admin-01',
    username: 'admin',
    passwordHash: '$2a$10$M1m29z1AC7XNKenYNF6FJuCxDOQtCARmmAhbwlHsXCnDwsfDC.oxq', // admin@123
    name: 'Administrator',
    role: ROLES.ADMIN,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'usr-faculty-01',
    username: 'faculty',
    passwordHash: '$2a$10$DtRsVaLTJ7bah8QHnpLvKeEcg5QHEI5OSpUZ1eYSRh8EUu04J4eau', // faculty@123
    name: 'Dr. John Faculty',
    role: ROLES.FACULTY,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'usr-staff-01',
    username: 'staff',
    passwordHash: '$2a$10$hDTh8xwyT9xvB67y5qORWeg2CA3oZIPYygfK0geIIRJG/ZcmSg3sK', // staff@123
    name: 'Lab Assistant Staff',
    role: ROLES.NON_TEACHING_STAFF,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'usr-inactive-01',
    username: 'inactive_user',
    passwordHash: '$2a$10$M1m29z1AC7XNKenYNF6FJuCxDOQtCARmmAhbwlHsXCnDwsfDC.oxq',
    name: 'Inactive User',
    role: ROLES.FACULTY,
    isActive: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
];

// Generate PC-01 through PC-64
const testSystems = [];
for (let i = 1; i <= 64; i++) {
  const code = `PC-${String(i).padStart(2, '0')}`;
  testSystems.push({
    id: `sys-${code}`,
    systemCode: code,
    hostname: `lab-${code.toLowerCase()}`,
    ipAddress: `192.168.1.${100 + i}`,
    status: SYSTEM_STATUS.AVAILABLE,
    lastSeenAt: new Date(),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });
}

const testStudents = [
  {
    id: 'stu-001',
    registrationNo: 'REG2026001',
    name: 'Alice Johnson',
    department: 'Computer Science',
    section: 'A',
    year: 3,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'stu-002',
    registrationNo: 'REG2026002',
    name: 'Bob Smith',
    department: 'Information Technology',
    section: 'B',
    year: 2,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
];

const testTimetables = [
  {
    id: 'tt-001',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '11:00',
    department: 'Computer Science',
    section: 'A',
    year: 3,
    subject: 'Database Systems Lab',
    facultyName: 'Dr. John Faculty',
    room: 'Lab 1',
    createdBy: 'admin',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
];

function getAuthToken(role = ROLES.ADMIN) {
  const user = testUsers.find((u) => u.role === role && u.isActive) || testUsers[0];
  return signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });
}

module.exports = {
  testUsers,
  testSystems,
  testStudents,
  testTimetables,
  getAuthToken,
};
