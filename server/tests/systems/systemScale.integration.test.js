'use strict';

const { request, prisma, resetDatabase } = require('../setup/testServer');
const { SYSTEM_STATUS } = require('../../src/utils/constants');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: generate IP for PC-NN → 192.168.10.(100+N)
// ─────────────────────────────────────────────────────────────────────────────
function pcIp(n) {
  return '192.168.10.' + (100 + n);
}

function pcCode(n) {
  return 'PC-' + String(n).padStart(2, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. All 64 systems exist and are uniquely identifiable
// ─────────────────────────────────────────────────────────────────────────────
describe('64-System Scale – Existence & Uniqueness', () => {
  beforeEach(() => resetDatabase());

  it('all 64 PC codes exist in the system list', async () => {
    const res = await request.get('/api/systems?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(64);

    for (let i = 1; i <= 64; i++) {
      const code = pcCode(i);
      expect(res.body.data.some(s => s.systemCode === code)).toBe(true);
    }
  });

  it('all 64 system IDs are unique', async () => {
    const res = await request.get('/api/systems?limit=100');
    const ids = res.body.data.map(s => s.id);
    expect(new Set(ids).size).toBe(64);
  });

  it('all 64 systemCodes are unique', async () => {
    const res = await request.get('/api/systems?limit=100');
    const codes = res.body.data.map(s => s.systemCode);
    expect(new Set(codes).size).toBe(64);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sequential heartbeat registration for all 64 systems
// ─────────────────────────────────────────────────────────────────────────────
describe('64-System Scale – Sequential Heartbeat & IP Registration', () => {
  beforeEach(() => resetDatabase());

  it('registers unique IP for each of the 64 systems', async () => {
    for (let i = 1; i <= 64; i++) {
      const code = pcCode(i);
      const ip = pcIp(i);
      const res = await request
        .post('/api/systems/heartbeat')
        .set('X-Forwarded-For', ip)
        .send({ systemCode: code, hostname: 'lab-' + code.toLowerCase() });

      expect(res.status).toBe(200);
      expect(res.body.data.systemCode).toBe(code);
      expect(res.body.data.ipAddress).toBe(ip);
    }
  }, 120000);

  it('all 64 systems have distinct IPs after sequential heartbeat', async () => {
    for (let i = 1; i <= 64; i++) {
      await request
        .post('/api/systems/heartbeat')
        .set('X-Forwarded-For', pcIp(i))
        .send({ systemCode: pcCode(i) });
    }

    const res = await request.get('/api/systems?limit=100');
    expect(res.status).toBe(200);
    const ips = res.body.data.map(s => s.ipAddress).filter(Boolean);
    // All IPs should be unique (no collisions from sequential registration)
    expect(new Set(ips).size).toBe(ips.length);
  }, 120000);

  it('no duplicate system records after repeated heartbeats', async () => {
    for (let round = 0; round < 3; round++) {
      for (let i = 1; i <= 64; i++) {
        await request
          .post('/api/systems/heartbeat')
          .set('X-Forwarded-For', pcIp(i))
          .send({ systemCode: pcCode(i) });
      }
    }

    const res = await request.get('/api/systems?limit=200');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(64); // still exactly 64
  }, 120000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DHCP-style IP changes for selected systems
// ─────────────────────────────────────────────────────────────────────────────
describe('64-System Scale – DHCP IP Change Simulation', () => {
  beforeEach(() => resetDatabase());

  const dhcpChanges = [
    { n: 1,  oldIp: '192.168.10.101', newIp: '192.168.10.201' },
    { n: 25, oldIp: '192.168.10.125', newIp: '192.168.10.225' },
    { n: 50, oldIp: '192.168.10.150', newIp: '192.168.10.250' },
    { n: 64, oldIp: '192.168.10.164', newIp: '192.168.10.230' },
  ];

  it('systemCode stays unchanged after DHCP IP change', async () => {
    for (const { n, oldIp, newIp } of dhcpChanges) {
      const code = pcCode(n);

      // Old IP heartbeat
      await request.post('/api/systems/heartbeat').set('X-Forwarded-For', oldIp).send({ systemCode: code });

      // New IP heartbeat (DHCP change)
      const res = await request.post('/api/systems/heartbeat').set('X-Forwarded-For', newIp).send({ systemCode: code });

      expect(res.status).toBe(200);
      expect(res.body.data.systemCode).toBe(code); // identity unchanged
      expect(res.body.data.ipAddress).toBe(newIp);   // IP updated
    }
  }, 60000);

  it('no new system records created during DHCP changes', async () => {
    for (const { n, oldIp, newIp } of dhcpChanges) {
      const code = pcCode(n);
      await request.post('/api/systems/heartbeat').set('X-Forwarded-For', oldIp).send({ systemCode: code });
      await request.post('/api/systems/heartbeat').set('X-Forwarded-For', newIp).send({ systemCode: code });
    }

    const res = await request.get('/api/systems?limit=200');
    expect(res.body.data.length).toBe(64);
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Concurrent heartbeat test (batch of 64 simultaneous requests)
// ─────────────────────────────────────────────────────────────────────────────
describe('64-System Scale – Concurrent Heartbeat', () => {
  beforeEach(() => resetDatabase());

  it('handles 64 concurrent heartbeats without corruption', async () => {
    const requests = [];
    for (let i = 1; i <= 64; i++) {
      requests.push(
        request
          .post('/api/systems/heartbeat')
          .set('X-Forwarded-For', pcIp(i))
          .send({ systemCode: pcCode(i) })
      );
    }

    const results = await Promise.all(requests);
    const allOk = results.every(r => r.status === 200);
    expect(allOk).toBe(true);
  }, 60000);

  it('all 64 systems still uniquely identifiable after concurrent heartbeats', async () => {
    const requests = [];
    for (let i = 1; i <= 64; i++) {
      requests.push(
        request.post('/api/systems/heartbeat').set('X-Forwarded-For', pcIp(i)).send({ systemCode: pcCode(i) })
      );
    }
    await Promise.all(requests);

    const res = await request.get('/api/systems?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(64);

    const codes = res.body.data.map(s => s.systemCode);
    expect(new Set(codes).size).toBe(64);
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. System list API – full 64-system result verification
// ─────────────────────────────────────────────────────────────────────────────
describe('System list API – 64-system correctness', () => {
  beforeEach(() => resetDatabase());

  it('GET /api/systems returns all 64 systems with correct fields', async () => {
    const res = await request.get('/api/systems?limit=100');
    expect(res.status).toBe(200);

    for (const sys of res.body.data) {
      expect(sys).toHaveProperty('id');
      expect(sys).toHaveProperty('systemCode');
      expect(sys).toHaveProperty('status');
    }
  });

  it('systems are ordered by systemCode', async () => {
    const res = await request.get('/api/systems?limit=100');
    expect(res.status).toBe(200);
    const codes = res.body.data.map(s => s.systemCode);
    const sorted = [...codes].sort();
    expect(codes).toEqual(sorted);
  });

  it('pagination metadata is correct for 64 systems', async () => {
    const res = await request.get('/api/systems?limit=20&page=1');
    expect(res.status).toBe(200);
    expect(res.body.pagination).toHaveProperty('total', 64);
    expect(res.body.data.length).toBeLessThanOrEqual(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. IP edge cases
// ─────────────────────────────────────────────────────────────────────────────
describe('IP edge cases', () => {
  beforeEach(() => resetDatabase());

  it('ignores invalid IP in body, falls back to req.ip', async () => {
    // send an invalid IP – heartbeat should still work (fall back to req.ip or null)
    const res = await request
      .post('/api/systems/heartbeat')
      .send({ systemCode: 'PC-01', ipAddress: '999.999.999.999' });
    expect(res.status).toBe(200); // heartbeat succeeds even if IP cannot be stored
  });

  it('heartbeat with empty body field still succeeds', async () => {
    const res = await request
      .post('/api/systems/heartbeat')
      .send({ systemCode: 'PC-03', ipAddress: '' });
    expect(res.status).toBe(200);
    expect(res.body.data.systemCode).toBe('PC-03');
  });

  it('system reconnects after IP change returns same systemCode', async () => {
    await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.1.20').send({ systemCode:'PC-20' });
    // simulate reconnect with different IP
    const res = await request.post('/api/systems/heartbeat').set('X-Forwarded-For','192.168.1.120').send({ systemCode:'PC-20' });
    expect(res.status).toBe(200);
    expect(res.body.data.systemCode).toBe('PC-20');
  });
});
