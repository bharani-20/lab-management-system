'use strict';

const { testUsers, testSystems, testStudents, testTimetables } = require('./testData');

class InMemoryPrismaStore {
  constructor() {
    this.resetDatabase();
  }

  resetDatabase() {
    this.users = JSON.parse(JSON.stringify(testUsers));
    this.systems = JSON.parse(JSON.stringify(testSystems));
    this.students = JSON.parse(JSON.stringify(testStudents));
    this.timetables = JSON.parse(JSON.stringify(testTimetables));
    this.sessions = [];
    this.attendances = [];
    this.tickets = [];
  }

  _matchesFilter(item, where) {
    if (!where) return true;
    for (const key of Object.keys(where)) {
      const condition = where[key];

      if (key === 'OR') {
        if (!Array.isArray(condition)) continue;
        const matchesAny = condition.some((cond) => this._matchesFilter(item, cond));
        if (!matchesAny) return false;
        continue;
      }

      if (key === 'studentId_date' && typeof condition === 'object') {
        if (item.studentId !== condition.studentId) return false;
        const d1 = new Date(item.date).setHours(0, 0, 0, 0);
        const d2 = new Date(condition.date).setHours(0, 0, 0, 0);
        if (d1 !== d2) return false;
        continue;
      }

      if (key === 'system' && typeof condition === 'object') {
        const sys = this.systems.find((s) => s.id === item.systemId);
        if (!sys || !this._matchesFilter(sys, condition)) return false;
        continue;
      }

      if (key === 'student' && typeof condition === 'object') {
        const stu = this.students.find((s) => s.id === item.studentId);
        if (!stu || !this._matchesFilter(stu, condition)) return false;
        continue;
      }

      const itemVal = item[key];

      if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
        if ('equals' in condition) {
          const mode = condition.mode;
          if (mode === 'insensitive' && typeof itemVal === 'string' && typeof condition.equals === 'string') {
            if (itemVal.toLowerCase() !== condition.equals.toLowerCase()) return false;
          } else if (itemVal !== condition.equals) {
            return false;
          }
        }
        if ('contains' in condition) {
          const mode = condition.mode;
          if (typeof itemVal !== 'string') return false;
          if (mode === 'insensitive') {
            if (!itemVal.toLowerCase().includes(condition.contains.toLowerCase())) return false;
          } else {
            if (!itemVal.includes(condition.contains)) return false;
          }
        }
        if ('gte' in condition) {
          const condDate = new Date(condition.gte).getTime();
          const itemDate = new Date(itemVal).getTime();
          if (isNaN(itemDate) || itemDate < condDate) return false;
        }
        if ('lte' in condition) {
          const condDate = new Date(condition.lte).getTime();
          const itemDate = new Date(itemVal).getTime();
          if (isNaN(itemDate) || itemDate > condDate) return false;
        }
        if ('lt' in condition) {
          const condDate = new Date(condition.lt).getTime();
          const itemDate = new Date(itemVal).getTime();
          if (isNaN(itemDate) || itemDate >= condDate) return false;
        }
        if ('gt' in condition) {
          const condDate = new Date(condition.gt).getTime();
          const itemDate = new Date(itemVal).getTime();
          if (isNaN(itemDate) || itemDate <= condDate) return false;
        }
        if ('not' in condition) {
          if (itemVal === condition.not) return false;
        }
      } else {
        if (itemVal !== condition) return false;
      }
    }
    return true;
  }

  _attachRelations(collectionName, item, include, select) {
    if (!item) return null;
    let res = { ...item };

    if (collectionName === 'sessions') {
      if (include && include.student) {
        const student = this.students.find((s) => s.id === item.studentId);
        res.student = student ? { ...student } : null;
      }
      if (include && include.system) {
        const system = this.systems.find((s) => s.id === item.systemId);
        res.system = system ? { ...system } : null;
      }
    } else if (collectionName === 'attendances') {
      if (include && include.student) {
        const student = this.students.find((s) => s.id === item.studentId);
        res.student = student ? { ...student } : null;
      }
      if (include && include.session) {
        const session = this.sessions.find((s) => s.id === item.sessionId);
        res.session = session ? { ...session } : null;
      }
    } else if (collectionName === 'tickets') {
      if (include && include.system) {
        const system = this.systems.find((s) => s.id === item.systemId);
        res.system = system ? { ...system } : null;
      }
    }

    if (select && typeof select === 'object') {
      const selected = {};
      for (const field of Object.keys(select)) {
        if (select[field]) {
          selected[field] = res[field];
        }
      }
      return selected;
    }

    return res;
  }

  _buildModel(collectionName) {
    const self = this;
    return {
      async findUnique({ where, include, select } = {}) {
        const list = self[collectionName];
        const found = list.find((item) => self._matchesFilter(item, where));
        return self._attachRelations(collectionName, found, include, select);
      },

      async findFirst({ where, include, select } = {}) {
        const list = self[collectionName];
        const found = list.find((item) => self._matchesFilter(item, where));
        return self._attachRelations(collectionName, found, include, select);
      },

      async findMany({ where, skip = 0, take, orderBy, include, select } = {}) {
        let list = self[collectionName].filter((item) => self._matchesFilter(item, where));

        if (orderBy) {
          const field = Array.isArray(orderBy) ? Object.keys(orderBy[0])[0] : Object.keys(orderBy)[0];
          const dir = Array.isArray(orderBy) ? Object.values(orderBy[0])[0] : Object.values(orderBy)[0];
          list.sort((a, b) => {
            if (a[field] < b[field]) return dir === 'desc' ? 1 : -1;
            if (a[field] > b[field]) return dir === 'desc' ? -1 : 1;
            return 0;
          });
        }

        const paginated = take !== undefined ? list.slice(skip, skip + take) : list.slice(skip);
        return paginated.map((item) => self._attachRelations(collectionName, item, include, select));
      },

      async count({ where } = {}) {
        return self[collectionName].filter((item) => self._matchesFilter(item, where)).length;
      },

      async groupBy({ by, _count } = {}) {
        const field = by[0];
        const counts = {};
        for (const item of self[collectionName]) {
          const val = item[field];
          counts[val] = (counts[val] || 0) + 1;
        }
        return Object.keys(counts).map((key) => ({
          [field]: key,
          _count: { _all: counts[key] },
        }));
      },

      async create({ data, include, select } = {}) {
        const newItem = {
          id: data.id || `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        self[collectionName].push(newItem);
        return self._attachRelations(collectionName, newItem, include, select);
      },

      async update({ where, data, include, select } = {}) {
        const index = self[collectionName].findIndex((item) => self._matchesFilter(item, where));
        if (index === -1) {
          const error = new Error(`Record to update not found.`);
          error.code = 'P2025';
          throw error;
        }
        const updated = {
          ...self[collectionName][index],
          ...data,
          updatedAt: new Date(),
        };
        self[collectionName][index] = updated;
        return self._attachRelations(collectionName, updated, include, select);
      },

      async delete({ where } = {}) {
        const index = self[collectionName].findIndex((item) => self._matchesFilter(item, where));
        if (index === -1) {
          const error = new Error(`Record to delete not found.`);
          error.code = 'P2025';
          throw error;
        }
        const deleted = self[collectionName].splice(index, 1)[0];
        return deleted;
      },

      async deleteMany({ where } = {}) {
        const initialCount = self[collectionName].length;
        self[collectionName] = self[collectionName].filter((item) => !self._matchesFilter(item, where));
        return { count: initialCount - self[collectionName].length };
      },

      async upsert({ where, update, create, include, select } = {}) {
        const found = self[collectionName].find((item) => self._matchesFilter(item, where));
        if (found) {
          return this.update({ where, data: update, include, select });
        } else {
          return this.create({ data: create, include, select });
        }
      },
    };
  }

  get user() {
    return this._buildModel('users');
  }
  get system() {
    return this._buildModel('systems');
  }
  get student() {
    return this._buildModel('students');
  }
  get session() {
    return this._buildModel('sessions');
  }
  get timetable() {
    return this._buildModel('timetables');
  }
  get attendance() {
    return this._buildModel('attendances');
  }
  get ticket() {
    return this._buildModel('tickets');
  }

  async $queryRaw(strings, ...values) {
    return [{ '?column?': 1 }];
  }

  async $transaction(arg) {
    if (typeof arg === 'function') {
      return arg(this);
    }
    if (Array.isArray(arg)) {
      const results = [];
      for (const p of arg) {
        results.push(await p);
      }
      return results;
    }
    return arg;
  }

  async $connect() {
    return true;
  }

  async $disconnect() {
    return true;
  }
}

const mockPrisma = new InMemoryPrismaStore();

module.exports = {
  prisma: mockPrisma,
  connectDatabase: async () => true,
  disconnectDatabase: async () => true,
  resetDatabase: () => mockPrisma.resetDatabase(),
  mockPrisma,
};
