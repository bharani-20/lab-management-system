'use strict';

const timetableService = require('../services/timetableService');
const { sendSuccess } = require('../utils/response');

async function listTimetables(req, res, next) {
  try {
    const result = await timetableService.listTimetables(req.query);
    return sendSuccess(res, result.timetables, 'Timetables retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function getTimetableById(req, res, next) {
  try {
    const timetable = await timetableService.getTimetableById(req.params.id);
    return sendSuccess(res, timetable, 'Timetable entry retrieved.');
  } catch (err) {
    next(err);
  }
}

async function createTimetable(req, res, next) {
  try {
    const createdBy = req.user ? req.user.username : 'system';
    const timetable = await timetableService.createTimetable(req.body, createdBy);
    return sendSuccess(res, timetable, 'Timetable entry created.', 201);
  } catch (err) {
    next(err);
  }
}

async function updateTimetable(req, res, next) {
  try {
    const timetable = await timetableService.updateTimetable(req.params.id, req.body);
    return sendSuccess(res, timetable, 'Timetable entry updated.');
  } catch (err) {
    next(err);
  }
}

async function deleteTimetable(req, res, next) {
  try {
    await timetableService.deleteTimetable(req.params.id);
    return sendSuccess(res, null, 'Timetable entry deleted.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTimetables,
  getTimetableById,
  createTimetable,
  updateTimetable,
  deleteTimetable,
};
