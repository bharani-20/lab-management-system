'use strict';

const { request, prisma, resetDatabase } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES, SYSTEM_STATUS } = require('../../src/utils/constants');
const { normalizeIp, isValidIpv4, extractClientIp } = require('../../src/utils/ipHelper');

const adminToken = getAuthToken(ROLES.ADMIN);
const facultyToken = getAuthToken(ROLES.FACULTY);
const staffToken = getAuthToken(ROLES.NON_TEACHING_STAFF);

// ---------------------------------------------------------------------------
// 1. ipHelper unit tests
// ---------------------------------------------------------------------------
describe('IP Helper - normalizeIp', () => {
  it('strips ::ffff: prefix', () => {
    expect(normalizeIp('::ffff:192.168.1.10')).toBe('192.168.1.10');
  });
  it('converts ::1 to 127.0.0.1', () => {
    expect(normalizeIp('::1')).toBe('127.0.0.1');
  });
  it('trims whitespace', () => {
    expect(normalizeIp('  192.168.10.5  ')).toBe('192.168.10.5');
  });
  it('returns null for empty/null', () => {
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp('')).toBeNull();
  });
});

describe('IP Helper - isValidIpv4', () => {
  ['192.168.1.1','10.0.0.1','172.16.254.1','255.255.255.0'].forEach(ip => {
    it('accepts ' + ip, () => expect(isValidIpv4(ip)).toBe(true));
  });
  ['999.999.999.999','abc.def.ghi.jkl','','256.0.0.1','192.168.1.1.1'].forEach(ip => {
    it('rejects ' + JSON.stringify(ip), () => expect(isValidIpv4(ip)).toBe(false));
  });
});

describe('IP Helper - extractClientIp', () => {
  const makeReq = (o = {}) => ({ headers: {}, ip: null, socket: { remoteAddress: null }, ...o });

  it('prefers valid reported IP', () => {
    expect(extractClientIp(makeReq({ ip: '10.0.0.1' }), '192.168.1.55')).toBe('192.168.1.55');
  });
  it('falls back to x-forwarded-for', () => {
    expect(extractClientIp(makeReq({ headers: { 'x-forwarded-for': '192.168.5.10, 10.0.0.1' } }), 'bad')).toBe('192.168.5.10');
  });
  it('falls back to req.ip', () => {
    expect(extractClientIp(makeReq({ ip: '192.168.3.3' }))).toBe('192.168.3.3');
  });
  it('strips ::ffff: from req.ip', () => {
    expect(extractClientIp(makeReq({ ip: '::ffff:192.168.2.2' }))).toBe('192.168.2.2');
  });
});

// ---------------------------------------------------------------------------
// 2. POST /api/systems/heartbeat
// ---------------------------------------------------------------------------
describe('POST /api/systems/heartbeat - automatic IP discovery', () => {
  beforeEach(() => resetDatabase());

  it('stores client IP for PC-01', async () => {
    const res = await request.post('/api/systems/heartbeat')
      .set('X-Forwarded-For', '192.168.10.101')
      .send({ systemCode: 'PC-01', hostname: 'lab-pc-01' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('systemCode', 'PC-01');
    expect(res.body.data).toHaveProperty('ipAddress', '192.168.10.101');
  });

  it('updates IP on DHCP change without creating duplicate', async () => {
    await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.10.101').send({ systemCode:'PC-01' });
    const res = await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.10.201').send({ systemCode:'PC-01' });
    expect(res.status).toBe(200);
    expect(res.body.data.ipAddress).toBe('192.168.10.201');
    expect(res.body.data.systemCode).toBe('PC-01');
    const list = await request.get('/api/systems?limit=200');
    expect(list.body.data.filter(s => s.systemCode === 'PC-01').length).toBe(1);
  });

  it('returns 404 for unknown systemCode', async () => {
    const res = await request.post('/api/systems/heartbeat').send({ systemCode: 'PC-99' });
    expect(res.status).toBe(404);
  });

  it('updates lastSeenAt', async () => {
    const before = Date.now();
    const res = await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.10.105').send({ systemCode:'PC-05' });
    expect(res.status).toBe(200);
    expect(new Date(res.body.data.lastSeenAt).getTime()).toBeGreaterThanOrEqual(before - 2000);
  });

  it('restores AVAILABLE for OFFLINE system', async () => {
    await prisma.system.update({ where: { systemCode: 'PC-02' }, data: { status: SYSTEM_STATUS.OFFLINE } });
    const res = await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.10.102').send({ systemCode:'PC-02' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(SYSTEM_STATUS.AVAILABLE);
  });
});

// ---------------------------------------------------------------------------
// 3. IP conflict
// ---------------------------------------------------------------------------
describe('IP conflict resolution', () => {
  beforeEach(() => resetDatabase());

  it('clears old system IP when new system claims same IP', async () => {
    await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.10.150').send({ systemCode:'PC-01' });
    await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.10.150').send({ systemCode:'PC-02' });
    const pc01 = await request.get('/api/systems/sys-PC-01');
    const pc02 = await request.get('/api/systems/sys-PC-02');
    expect(pc01.body.data.ipAddress).not.toBe('192.168.10.150');
    expect(pc02.body.data.ipAddress).toBe('192.168.10.150');
    expect(pc01.body.data.systemCode).toBe('PC-01');
    expect(pc02.body.data.systemCode).toBe('PC-02');
  });
});

// ---------------------------------------------------------------------------
// 4. Identity independence
// ---------------------------------------------------------------------------
describe('System identity is independent from IP', () => {
  beforeEach(() => resetDatabase());

  it('systemCode unchanged after multiple IP changes', async () => {
    for (const ip of ['192.168.10.201','192.168.10.202','192.168.10.203']) {
      await request.post('/api/systems/heartbeat').set('X-Forwarded-For', ip).send({ systemCode:'PC-10' });
    }
    const res = await request.get('/api/systems/sys-PC-10');
    expect(res.body.data.systemCode).toBe('PC-10');
    expect(res.body.data.ipAddress).toBe('192.168.10.203');
  });

  it('offline system retains last known IP', async () => {
    await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.10.110').send({ systemCode:'PC-10' });
    await prisma.system.update({ where: { systemCode: 'PC-10' }, data: { status: SYSTEM_STATUS.OFFLINE } });
    const res = await request.get('/api/systems/sys-PC-10');
    expect(res.body.data.ipAddress).toBe('192.168.10.110');
    expect(res.body.data.status).toBe(SYSTEM_STATUS.OFFLINE);
  });
});

// ---------------------------------------------------------------------------
// 5. Security
// ---------------------------------------------------------------------------
describe('Security - unauthorized IP manipulation', () => {
  beforeEach(() => resetDatabase());

  it('FACULTY cannot update system', async () => {
    const res = await request.put('/api/systems/sys-PC-01')
      .set('Authorization', 'Bearer ' + facultyToken)
      .send({ ipAddress: '10.10.10.10', status: SYSTEM_STATUS.MAINTENANCE });
    expect(res.status).toBe(403);
  });

  it('NON_TEACHING_STAFF cannot update system', async () => {
    const res = await request.put('/api/systems/sys-PC-01')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ ipAddress: '10.10.10.10' });
    expect(res.status).toBe(403);
  });

  it('ADMIN can update system status', async () => {
    const res = await request.put('/api/systems/sys-PC-01')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ status: SYSTEM_STATUS.MAINTENANCE });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(SYSTEM_STATUS.MAINTENANCE);
  });

  it('system list does not expose secrets', async () => {
    const res = await request.get('/api/systems?limit=5');
    expect(res.status).toBe(200);
    res.body.data.forEach(sys => {
      expect(sys).not.toHaveProperty('passwordHash');
      expect(sys).not.toHaveProperty('secret');
    });
  });
});
