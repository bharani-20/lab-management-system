'use strict';

const { request } = require('../setup/testServer');
const { FACULTY_MEMBERS } = require('../../src/utils/constants');

describe('Faculty Endpoint Tests (GET /api/faculty)', () => {
  it('GET /api/faculty should return faculty list for kiosk dropdown', async () => {
    const res = await request.get('/api/faculty');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('faculty');
    expect(Array.isArray(res.body.data.faculty)).toBe(true);
    expect(res.body.data.faculty.length).toBe(FACULTY_MEMBERS.length);
    expect(res.body.data.faculty).toContain('Dr. D. Sathya');
    expect(res.body.data.faculty).toContain('Ms. C. Vasuki');
  });

  it('GET /api/faculty should include formatted members with IDs', async () => {
    const res = await request.get('/api/faculty');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('members');
    expect(Array.isArray(res.body.data.members)).toBe(true);
    expect(res.body.data.members[0]).toHaveProperty('id');
    expect(res.body.data.members[0]).toHaveProperty('name');
  });
});
