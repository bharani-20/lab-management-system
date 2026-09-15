'use strict';

const studentService = require('../services/studentService');
const { sendSuccess } = require('../utils/response');

async function listStudents(req, res, next) {
  try {
    const result = await studentService.listStudents(req.query);
    return sendSuccess(res, result.students, 'Students retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function getStudentById(req, res, next) {
  try {
    const student = await studentService.getStudentById(req.params.id);
    return sendSuccess(res, student, 'Student retrieved.');
  } catch (err) {
    next(err);
  }
}

async function getStudentPresence(req, res, next) {
  try {
    const userRole = req.user ? req.user.role : 'ADMIN';
    const result = await studentService.getStudentPresence(req.query, userRole);
    return sendSuccess(res, result.presence, 'Student presence retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function createStudent(req, res, next) {
  try {
    const student = await studentService.createStudent(req.body);
    return sendSuccess(res, student, 'Student created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

async function updateStudent(req, res, next) {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);
    return sendSuccess(res, student, 'Student updated successfully.');
  } catch (err) {
    next(err);
  }
}

async function deleteStudent(req, res, next) {
  try {
    await studentService.deleteStudent(req.params.id);
    return sendSuccess(res, null, 'Student deleted successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStudents,
  getStudentById,
  getStudentPresence,
  createStudent,
  updateStudent,
  deleteStudent,
};
