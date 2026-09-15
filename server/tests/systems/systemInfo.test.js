'use strict';

const { request } = require('../setup/testServer');

describe('System Info Endpoint Tests (GET /api/system/info)', () => {
  it('GET /api/system/info with systemCode should return system details', async () => {
    const res = await request.get('/api/system/info?systemCode=PC-01');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('systemCode', 'PC-01');
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('serverTime');
  });

  it('GET /api/system/info with systemNumber LAB1-PC05 should normalize and return PC-05', async () => {
    const res = await request.get('/api/system/info?systemNumber=LAB1-PC05');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('systemCode', 'PC-05');
  });

  it('GET /api/systems/info alias should also return system details', async () => {
    const res = await request.get('/api/systems/info?systemCode=PC-02');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('systemCode', 'PC-02');
  });

  it('GET /api/system/info without query should return general server status', async () => {
    const res = await request.get('/api/system/info');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('serverTime');
  });

  it('GET /api/system/info for non-existent system should return 404', async () => {
    const res = await request.get('/api/system/info?systemCode=PC-999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
