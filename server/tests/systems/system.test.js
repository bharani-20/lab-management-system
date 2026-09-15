'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES, SYSTEM_STATUS } = require('../../src/utils/constants');

describe('8. System / Lab PC Tests (PC-01 to PC-64)', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  describe('Database Integrity of 64 Lab PCs', () => {
    it('should list systems containing all 64 PCs from PC-01 through PC-64', async () => {
      const res = await request.get('/api/systems?limit=100');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(64);

      for (let i = 1; i <= 64; i++) {
        const code = `PC-${String(i).padStart(2, '0')}`;
        const found = res.body.data.some((s) => s.systemCode === code);
        expect(found).toBe(true);
      }
    });
  });

  describe('System Details & Status Changes', () => {
    it('GET /api/systems/:id should return single system details', async () => {
      const res = await request.get('/api/systems/sys-PC-01');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('systemCode', 'PC-01');
      expect(res.body.data).toHaveProperty('status', SYSTEM_STATUS.AVAILABLE);
    });

    it('PUT /api/systems/:id should allow ADMIN to update status to MAINTENANCE', async () => {
      const res = await request
        .put('/api/systems/sys-PC-01')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: SYSTEM_STATUS.MAINTENANCE });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SYSTEM_STATUS.MAINTENANCE);
    });

    it('PUT /api/systems/:id should reject status update from FACULTY with 403', async () => {
      const res = await request
        .put('/api/systems/sys-PC-01')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ status: SYSTEM_STATUS.AVAILABLE });

      expect(res.status).toBe(403);
    });
  });

  describe('Conflict & Error Handling', () => {
    it('POST /api/systems should reject duplicate systemCode with 409', async () => {
      const res = await request
        .post('/api/systems')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ systemCode: 'PC-01', hostname: 'duplicate-pc' });

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty('code', 'DUPLICATE_SYSTEM_CODE');
    });

    it('GET /api/systems/:id should return 404 for invalid system id', async () => {
      const res = await request.get('/api/systems/invalid-sys-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty('code', 'SYSTEM_NOT_FOUND');
    });
  });
});
