'use strict';

const { resetDatabase, prisma } = require('./testDatabase');

// Globally mock Prisma database module for all tests
jest.mock('../../src/config/database', () => {
  const testDb = require('./testDatabase');
  return {
    prisma: testDb.prisma,
    connectDatabase: testDb.connectDatabase,
    disconnectDatabase: testDb.disconnectDatabase,
  };
});

const request = require('supertest');
const app = require('../../src/app');

beforeEach(() => {
  resetDatabase();
});

module.exports = {
  app,
  request: request(app),
  prisma,
  resetDatabase,
};
