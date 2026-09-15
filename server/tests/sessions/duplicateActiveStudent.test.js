'use strict';

/**
 * Duplicate Active Student Login Restriction Tests
 *
 * Feature: Prevent the same student Registration Number from having
 * more than ONE ACTIVE LAB SESSION at the same time across all workstations.
 *
 * Expected error response on conflict:
 *   HTTP 409  |  errorCode: "STUDENT_ALREADY_ACTIVE"  |  message: "Invalid User"
 */

const { request } = require('../setup/testServer');
const { resetDatabase } = require('../setup/testDatabase');
const { SESSION_STATUS } = require('../../src/utils/constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE_STUDENT = {
  registrationNo: 'REG2026001',
  name: 'Alice Johnson',
  department: 'Computer Science',
  section: 'A',
  year: 3,
  durationMinutes: 60,
};

function sessionPayload(overrides = {}) {
  return { ...BASE_STUDENT, ...overrides };
}

async function startSession(overrides = {}) {
  return request.post('/api/sessions').send(sessionPayload(overrides));
}

async function endSession(sessionId) {
  return request.patch(`/api/sessions/${sessionId}/end`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Duplicate Active Student Login Restriction', () => {
  beforeEach(() => resetDatabase());

  // ── TC-01 ─────────────────────────────────────────────────────────────────
  it('TC-01: Rejects second session on different PC for same student -> 409 STUDENT_ALREADY_ACTIVE', async () => {
    const first = await startSession({ localId: 'dup-tc01-a', systemCode: 'PC-01' });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe(SESSION_STATUS.ACTIVE);

    const second = await startSession({ localId: 'dup-tc01-b', systemCode: 'PC-02' });
    expect(second.status).toBe(409);
    expect(second.body.errorCode).toBe('STUDENT_ALREADY_ACTIVE');
    expect(second.body.message).toBe('Invalid User');
  });

  // ── TC-02 ─────────────────────────────────────────────────────────────────
  it('TC-02: Case-insensitive registrationNo normalization', async () => {
    const first = await startSession({ localId: 'dup-tc02-a', systemCode: 'PC-01', registrationNo: 'REG2026001' });
    expect(first.status).toBe(201);

    const second = await startSession({ localId: 'dup-tc02-b', systemCode: 'PC-02', registrationNo: 'reg2026001' });
    expect(second.status).toBe(409);
    expect(second.body.errorCode).toBe('STUDENT_ALREADY_ACTIVE');
  });

  // ── TC-03 ─────────────────────────────────────────────────────────────────
  it('TC-03: Whitespace trimming in registrationNo', async () => {
    const first = await startSession({ localId: 'dup-tc03-a', systemCode: 'PC-01', registrationNo: 'REG2026001' });
    expect(first.status).toBe(201);

    const second = await startSession({
      localId: 'dup-tc03-b',
      systemCode: 'PC-03',
      registrationNo: '  REG2026001  ',
    });
    expect(second.status).toBe(409);
    expect(second.body.errorCode).toBe('STUDENT_ALREADY_ACTIVE');
  });

  // ── TC-04 ─────────────────────────────────────────────────────────────────
  it('TC-04: Idempotency - same localId submitted twice returns existing session, not an error', async () => {
    const first = await startSession({ localId: 'dup-tc04-idem', systemCode: 'PC-01' });
    expect(first.status).toBe(201);

    const second = await startSession({ localId: 'dup-tc04-idem', systemCode: 'PC-01' });
    expect(second.status).toBe(201);
    expect(second.body.data.localId).toBe('dup-tc04-idem');
  });

  // ── TC-05 ─────────────────────────────────────────────────────────────────
  it('TC-05: After ending first session, student can start a new session on any PC', async () => {
    const first = await startSession({ localId: 'dup-tc05-a', systemCode: 'PC-01' });
    expect(first.status).toBe(201);
    const sessionId = first.body.data.id;

    const ended = await endSession(sessionId);
    expect(ended.status).toBe(200);
    expect(ended.body.data.status).toBe(SESSION_STATUS.COMPLETED);

    const second = await startSession({ localId: 'dup-tc05-b', systemCode: 'PC-02' });
    expect(second.status).toBe(201);
    expect(second.body.data.status).toBe(SESSION_STATUS.ACTIVE);
  });

  // ── TC-06 ─────────────────────────────────────────────────────────────────
  it('TC-06: Different student on same PC after first session ends is allowed', async () => {
    const first = await startSession({ localId: 'dup-tc06-a', systemCode: 'PC-04' });
    expect(first.status).toBe(201);
    await endSession(first.body.data.id);

    const second = await request.post('/api/sessions').send(
      sessionPayload({
        localId: 'dup-tc06-b',
        systemCode: 'PC-04',
        registrationNo: 'REG2026002',
        name: 'Bob Smith',
        department: 'Information Technology',
        section: 'B',
        year: 2,
      })
    );
    expect(second.status).toBe(201);
    expect(second.body.data.status).toBe(SESSION_STATUS.ACTIVE);
  });

  // ── TC-07 ─────────────────────────────────────────────────────────────────
  it('TC-07: Two different students can each have one active session simultaneously', async () => {
    const first = await startSession({ localId: 'dup-tc07-a', systemCode: 'PC-10' });
    expect(first.status).toBe(201);

    const second = await request.post('/api/sessions').send(
      sessionPayload({
        localId: 'dup-tc07-b',
        systemCode: 'PC-11',
        registrationNo: 'REG2026002',
        name: 'Bob Smith',
        department: 'IT',
        section: 'B',
        year: 2,
      })
    );
    expect(second.status).toBe(201);
    expect(second.body.data.status).toBe(SESSION_STATUS.ACTIVE);
  });

  // ── TC-08 ─────────────────────────────────────────────────────────────────
  it('TC-08: System-busy check fires when different student tries a busy PC -> 409 SYSTEM_BUSY', async () => {
    await request.post('/api/sessions').send(
      sessionPayload({
        localId: 'dup-tc08-studentB',
        systemCode: 'PC-20',
        registrationNo: 'REG2026002',
        name: 'Bob Smith',
        department: 'IT',
        section: 'B',
        year: 2,
      })
    );

    const res = await startSession({ localId: 'dup-tc08-studentA', systemCode: 'PC-20' });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('SYSTEM_BUSY');
  });

  // ── TC-09 ─────────────────────────────────────────────────────────────────
  it('TC-09: STUDENT_ALREADY_ACTIVE when same student tries same busy PC', async () => {
    await startSession({ localId: 'dup-tc09-a', systemCode: 'PC-01' });

    const res = await startSession({ localId: 'dup-tc09-b', systemCode: 'PC-01' });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('STUDENT_ALREADY_ACTIVE');
    expect(res.body.message).toBe('Invalid User');
  });

  // ── TC-10 ─────────────────────────────────────────────────────────────────
  it('TC-10: Offline sync ACTIVE session downgraded to CONFLICT when student is already active online', async () => {
    const online = await startSession({ localId: 'dup-tc10-online', systemCode: 'PC-30' });
    expect(online.status).toBe(201);

    const syncPayload = [
      {
        localId: 'dup-tc10-offline',
        registrationNo: 'REG2026001',
        name: 'Alice Johnson',
        department: 'Computer Science',
        section: 'A',
        year: 3,
        durationMinutes: 45,
        systemCode: 'PC-31',
        startTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        status: 'ACTIVE',
      },
    ];

    const syncRes = await request.post('/api/sync/sessions').send({ sessions: syncPayload });
    expect(syncRes.status).toBe(200);

    const resultItem = syncRes.body.data.results.find((r) => r.localId === 'dup-tc10-offline');
    expect(resultItem).toBeDefined();
    expect(resultItem.result).toBe('conflict');
    expect(resultItem.message).toMatch(/CONFLICT|already active/i);
  });
});
