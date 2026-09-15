'use strict';

const { request, prisma, resetDatabase } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES, SYSTEM_STATUS } = require('../../src/utils/constants');
const { normalizeIp, isValidIpv4, extractClientIp } = require('../../src/utils/ipHelper');

describe('System Identification, Dynamic IP & 64-PC Concurrency Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  beforeEach(() => {
    resetDatabase();
  });

  describe('IP Utility & Normalization', () => {
    it('should normalize IPv4-mapped IPv6 addresses', () => {
      expect(normalizeIp('::ffff:192.168.1.101')).toBe('192.168.1.101');
      expect(normalizeIp('::ffff:10.0.0.1')).toBe('10.0.0.1');
    });

    it('should map localhost ::1 to 127.0.0.1', () => {
      expect(normalizeIp('::1')).toBe('127.0.0.1');
    });

    it('should validate standard IPv4 and reject malformed inputs', () => {
      expect(isValidIpv4('192.168.1.1')).toBe(true);
      expect(isValidIpv4('10.0.0.254')).toBe(true);
      expect(isValidIpv4('256.1.1.1')).toBe(false);
      expect(isValidIpv4('not-an-ip')).toBe(false);
      expect(isValidIpv4('')).toBe(false);
      expect(isValidIpv4(null)).toBe(false);
    });

    it('should extract client IP correctly from mock req', () => {
      const mockReq = { socket: { remoteAddress: '::ffff:192.168.1.105' } };
      expect(extractClientIp(mockReq)).toBe('192.168.1.105');
    });
  });

  describe('Automatic System Identification & Dynamic IP Update', () => {
    it('should update currentIp, lastSeen, and mark system AVAILABLE/ONLINE upon heartbeat', async () => {
      const res = await request
        .post('/api/systems/heartbeat')
        .send({ systemCode: 'PC-01', ipAddress: '192.168.1.101', hostname: 'LAB-PC-01' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('systemCode', 'PC-01');
      expect(res.body.data).toHaveProperty('currentIp', '192.168.1.101');
      expect(res.body.data).toHaveProperty('online', true);
      expect(res.body.data).toHaveProperty('lastSeen');

      const sys = await prisma.system.findUnique({ where: { systemCode: 'PC-01' } });
      expect(sys.ipAddress).toBe('192.168.1.101');
      expect(sys.status).toBe(SYSTEM_STATUS.AVAILABLE);
    });

    it('should handle DHCP IP change: update currentIp while keeping permanent systemCode PC-01', async () => {
      // 1. Initial IP assignment
      await request
        .post('/api/systems/heartbeat')
        .send({ systemCode: 'PC-01', ipAddress: '192.168.1.101' });

      let sys = await prisma.system.findUnique({ where: { systemCode: 'PC-01' } });
      expect(sys.ipAddress).toBe('192.168.1.101');

      // 2. DHCP dynamic IP change occurs (192.168.1.101 -> 192.168.1.125)
      const changeRes = await request
        .post('/api/systems/heartbeat')
        .send({ systemCode: 'PC-01', ipAddress: '192.168.1.125' });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.data.systemCode).toBe('PC-01');
      expect(changeRes.body.data.currentIp).toBe('192.168.1.125');

      // Permanent systemCode is preserved, no new row is created
      sys = await prisma.system.findUnique({ where: { systemCode: 'PC-01' } });
      expect(sys.ipAddress).toBe('192.168.1.125');

      const totalSystems = await prisma.system.count();
      expect(totalSystems).toBe(64);
    });

    it('should preserve last known IP when system is marked OFFLINE and restore to AVAILABLE on reconnect', async () => {
      // 1. Set IP via heartbeat
      await request
        .post('/api/systems/heartbeat')
        .send({ systemCode: 'PC-05', ipAddress: '192.168.1.105' });

      // 2. Transition to OFFLINE (e.g. disconnected)
      await prisma.system.update({
        where: { systemCode: 'PC-05' },
        data: { status: SYSTEM_STATUS.OFFLINE },
      });

      // 3. Verify last known IP is retained while offline
      let sys = await prisma.system.findUnique({ where: { systemCode: 'PC-05' } });
      expect(sys.status).toBe(SYSTEM_STATUS.OFFLINE);
      expect(sys.ipAddress).toBe('192.168.1.105');

      // 4. Client reconnects with new DHCP IP
      const reconnectRes = await request
        .post('/api/systems/heartbeat')
        .send({ systemCode: 'PC-05', ipAddress: '192.168.1.155' });

      expect(reconnectRes.status).toBe(200);
      expect(reconnectRes.body.data.status).toBe(SYSTEM_STATUS.AVAILABLE);
      expect(reconnectRes.body.data.currentIp).toBe('192.168.1.155');
    });

    it('should safely detect duplicate IP conflict across systems without corrupting records', async () => {
      // PC-01 gets 192.168.1.125
      await request
        .post('/api/systems/heartbeat')
        .send({ systemCode: 'PC-01', ipAddress: '192.168.1.125' });

      // PC-02 now reports 192.168.1.125 (DHCP reassignment collision)
      const res = await request
        .post('/api/systems/heartbeat')
        .send({ systemCode: 'PC-02', ipAddress: '192.168.1.125' });

      expect(res.status).toBe(200);
      expect(res.body.data.systemCode).toBe('PC-02');
      expect(res.body.data.currentIp).toBe('192.168.1.125');

      // Both PC-01 and PC-02 permanent records exist intact
      const pc01 = await prisma.system.findUnique({ where: { systemCode: 'PC-01' } });
      const pc02 = await prisma.system.findUnique({ where: { systemCode: 'PC-02' } });

      expect(pc01).not.toBeNull();
      expect(pc02).not.toBeNull();
      expect(pc02.ipAddress).toBe('192.168.1.125');
      expect(pc01.ipAddress).toBeNull(); // Cleared to resolve collision
    });
  });

  describe('64-PC Concurrency Test', () => {
    it('should handle all 64 PCs (PC-01 through PC-64) sending heartbeats concurrently', async () => {
      const heartbeatPromises = [];

      for (let i = 1; i <= 64; i++) {
        const num = String(i).padStart(2, '0');
        const systemCode = `PC-${num}`;
        const ipAddress = `192.168.1.${100 + i}`;

        const promise = request
          .post('/api/systems/heartbeat')
          .send({ systemCode, ipAddress, hostname: `LAB-PC-${num}` });

        heartbeatPromises.push(promise);
      }

      const responses = await Promise.all(heartbeatPromises);

      // Verify all 64 responses succeeded
      expect(responses.length).toBe(64);
      responses.forEach((res, index) => {
        const num = String(index + 1).padStart(2, '0');
        expect(res.status).toBe(200);
        expect(res.body.data.systemCode).toBe(`PC-${num}`);
        expect(res.body.data.currentIp).toBe(`192.168.1.${100 + index + 1}`);
        expect(res.body.data.online).toBe(true);
      });

      // Verify total system count in database is exactly 64 (no duplicates created)
      const count = await prisma.system.count();
      expect(count).toBe(64);
    });
  });
});
