'use strict';

const { request, prisma } = require('../setup/testServer');
const { resetDatabase } = require('../setup/testDatabase');
const { calculateExpectedEndTime } = require('../../src/services/sessionService');
const { ROLES, SESSION_STATUS } = require('../../src/utils/constants');
const { getAuthToken } = require('../setup/testData');

// ─── Base payload helper ─────────────────────────────────────────────────────

const BASE = {
  registrationNo: 'REG2026001',
  name: 'Alice Johnson',
  department: 'Computer Science',
  section: 'A',
  year: 3,
  durationMinutes: 60,
};

function payload(overrides = {}) {
  return { ...BASE, ...overrides };
}

// ─── Original tests (preserved) ───────────────────────────────────────────────

describe('10 & 11. Automatic Session Timing and End Time Tests', () => {
  beforeEach(() => resetDatabase());

  it('should automatically compute expectedEndTime = startTime + durationMinutes on backend', () => {
    const fixedStart = new Date('2026-09-11T14:15:00.000Z');
    const expected = calculateExpectedEndTime(fixedStart, 60);
    expect(expected.toISOString()).toBe('2026-09-11T15:15:00.000Z');
  });

  it('POST /api/sessions should store system-generated startTime and expectedEndTime in DB', async () => {
    const res = await request.post('/api/sessions').send(payload({
      localId: 'loc-timing-001',
      systemCode: 'PC-02',
      durationMinutes: 90,
    }));

    expect(res.status).toBe(201);

    const dbSession = await prisma.session.findUnique({ where: { localId: 'loc-timing-001' } });
    expect(dbSession).toBeDefined();
    expect(dbSession.startTime).toBeInstanceOf(Date);
    expect(dbSession.expectedEndTime).toBeInstanceOf(Date);

    const diffMinutes = (dbSession.expectedEndTime.getTime() - dbSession.startTime.getTime()) / (60 * 1000);
    expect(Math.round(diffMinutes)).toBe(90);
  });

  it('POST /api/sessions should reject attempts to manually submit expectedEndTime or actualEndTime', async () => {
    const res = await request.post('/api/sessions').send(payload({
      localId: 'loc-timing-tamper',
      systemCode: 'PC-03',
      expectedEndTime: '2026-09-11T20:00:00.000Z',
    }));
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('success', false);
  });

  it('PATCH /api/sessions/:id/end should automatically generate actualEndTime >= startTime', async () => {
    const startRes = await request.post('/api/sessions').send(payload({
      localId: 'loc-timing-end-01',
      systemCode: 'PC-04',
      durationMinutes: 30,
    }));
    const sessionId = startRes.body.data.id;

    const endRes = await request.patch(`/api/sessions/${sessionId}/end`);
    expect(endRes.status).toBe(200);

    const dbSession = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(dbSession.actualEndTime).toBeInstanceOf(Date);
    expect(dbSession.actualEndTime.getTime()).toBeGreaterThanOrEqual(dbSession.startTime.getTime());
  });
});

// ─── NEW: Automatic Start Time Feature Tests ──────────────────────────────────

describe('Automatic Session Start Time from Backend Server Clock', () => {
  beforeEach(() => resetDatabase());

  // TC-T1 ────────────────────────────────────────────────────────────────────
  it('TC-T1: Online session stores backend-generated startTime (within test window)', async () => {
    const beforeRequest = Date.now();

    const res = await request.post('/api/sessions').send(payload({
      localId: 'tm-t1',
      systemCode: 'PC-05',
    }));
    expect(res.status).toBe(201);

    const afterRequest = Date.now();
    const db = await prisma.session.findUnique({ where: { localId: 'tm-t1' } });

    expect(db.startTime).toBeInstanceOf(Date);
    expect(db.startTime.getTime()).toBeGreaterThanOrEqual(beforeRequest);
    expect(db.startTime.getTime()).toBeLessThanOrEqual(afterRequest + 100);
  });

  // TC-T2 ────────────────────────────────────────────────────────────────────
  it('TC-T2: Client-sent startTime is rejected (422) for online session — schema is strict', async () => {
    const res = await request.post('/api/sessions').send({
      ...payload({ localId: 'tm-t2', systemCode: 'PC-06' }),
      startTime: '2020-01-01T10:00:00.000Z', // Fake/tampered timestamp
    });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  // TC-T3 ────────────────────────────────────────────────────────────────────
  it('TC-T3: expectedEndTime = startTime + durationMinutes (backend formula, 45 min)', async () => {
    const res = await request.post('/api/sessions').send(payload({
      localId: 'tm-t3',
      systemCode: 'PC-07',
      durationMinutes: 45,
    }));
    expect(res.status).toBe(201);

    const db = await prisma.session.findUnique({ where: { localId: 'tm-t3' } });
    const diffMin = (db.expectedEndTime.getTime() - db.startTime.getTime()) / 60000;
    expect(Math.round(diffMin)).toBe(45);
  });

  // TC-T4 ────────────────────────────────────────────────────────────────────
  it('TC-T4: startTime is generated at session creation moment, not before', async () => {
    const beforeMs = Date.now();
    const res = await request.post('/api/sessions').send(payload({
      localId: 'tm-t4',
      systemCode: 'PC-08',
    }));
    const afterMs = Date.now();

    expect(res.status).toBe(201);
    const db = await prisma.session.findUnique({ where: { localId: 'tm-t4' } });
    expect(db.startTime.getTime()).toBeGreaterThanOrEqual(beforeMs);
    expect(db.startTime.getTime()).toBeLessThanOrEqual(afterMs + 100);
  });

  // TC-T5 ────────────────────────────────────────────────────────────────────
  it('TC-T5: Offline sync accepts and preserves client-provided startTime', async () => {
    const offlineStart = new Date('2026-09-15T08:00:00.000Z');

    const syncRes = await request.post('/api/sync/sessions').send({
      sessions: [{
        localId: 'tm-t5-offline',
        registrationNo: 'REG2026002',
        name: 'Bob Smith',
        department: 'IT',
        section: 'B',
        year: 2,
        durationMinutes: 30,
        systemCode: 'PC-09',
        startTime: offlineStart.toISOString(),
        status: 'COMPLETED',
        actualEndTime: new Date('2026-09-15T08:30:00.000Z').toISOString(),
      }],
    });

    expect(syncRes.status).toBe(200);
    const result = syncRes.body.data.results.find((r) => r.localId === 'tm-t5-offline');
    expect(result.result).toBe('synced');

    const db = await prisma.session.findUnique({ where: { localId: 'tm-t5-offline' } });
    expect(db.startTime.getTime()).toBe(offlineStart.getTime());
  });

  // TC-T6 ────────────────────────────────────────────────────────────────────
  it('TC-T6: Client startTime accepted only through offline sync, not online API', async () => {
    // Online attempt with startTime → rejected
    const onlineRes = await request.post('/api/sessions').send({
      ...payload({ localId: 'tm-t6-online', systemCode: 'PC-10' }),
      startTime: '2020-01-01T00:00:00.000Z',
    });
    expect(onlineRes.status).toBe(422);

    // Offline sync with startTime → accepted
    const offlineRes = await request.post('/api/sync/sessions').send({
      sessions: [{
        localId: 'tm-t6-offline',
        registrationNo: 'REG2026002',
        name: 'Bob Smith',
        department: 'IT',
        section: 'B',
        year: 2,
        durationMinutes: 60,
        systemCode: 'PC-10',
        startTime: '2026-09-15T07:00:00.000Z',
        status: 'COMPLETED',
      }],
    });
    expect(offlineRes.status).toBe(200);
    const r = offlineRes.body.data.results[0];
    expect(r.result).toBe('synced');
  });

  // TC-T7 ────────────────────────────────────────────────────────────────────
  it('TC-T7: Duplicate active registration still protected after timing changes', async () => {
    await request.post('/api/sessions').send(payload({ localId: 'tm-t7-a', systemCode: 'PC-11' }));

    const res = await request.post('/api/sessions').send(payload({ localId: 'tm-t7-b', systemCode: 'PC-12' }));
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('STUDENT_ALREADY_ACTIVE');
    expect(res.body.message).toBe('Invalid User');
  });

  // TC-T8 ────────────────────────────────────────────────────────────────────
  it('TC-T8: actualEndTime is set by backend server clock at session end', async () => {
    const startRes = await request.post('/api/sessions').send(payload({
      localId: 'tm-t8',
      systemCode: 'PC-13',
    }));
    expect(startRes.status).toBe(201);

    const beforeEnd = Date.now();
    const endRes = await request.patch(`/api/sessions/${startRes.body.data.id}/end`);
    const afterEnd = Date.now();
    expect(endRes.status).toBe(200);

    const db = await prisma.session.findUnique({ where: { localId: 'tm-t8' } });
    expect(db.actualEndTime).toBeInstanceOf(Date);
    expect(db.actualEndTime.getTime()).toBeGreaterThanOrEqual(beforeEnd);
    expect(db.actualEndTime.getTime()).toBeLessThanOrEqual(afterEnd + 100);
  });

  // TC-T9 ────────────────────────────────────────────────────────────────────
  it('TC-T9: ADMIN sees timing fields; FACULTY and NON_TEACHING_STAFF do not', async () => {
    const createRes = await request.post('/api/sessions').send(payload({
      localId: 'tm-t9',
      systemCode: 'PC-14',
    }));
    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.data.id;

    const adminToken = getAuthToken(ROLES.ADMIN);
    const facultyToken = getAuthToken(ROLES.FACULTY);
    const staffToken = getAuthToken(ROLES.NON_TEACHING_STAFF);

    // ADMIN — must see timing
    const adminRes = await request
      .get(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data).toHaveProperty('startTime');
    expect(adminRes.body.data).toHaveProperty('expectedEndTime');

    // FACULTY — must NOT see timing
    const facultyRes = await request
      .get(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(facultyRes.status).toBe(200);
    expect(facultyRes.body.data).not.toHaveProperty('startTime');
    expect(facultyRes.body.data).not.toHaveProperty('expectedEndTime');
    expect(facultyRes.body.data).not.toHaveProperty('actualEndTime');

    // NON_TEACHING_STAFF — must NOT see timing
    const staffRes = await request
      .get(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.data).not.toHaveProperty('startTime');
    expect(staffRes.body.data).not.toHaveProperty('expectedEndTime');
    expect(staffRes.body.data).not.toHaveProperty('actualEndTime');
  });
});
