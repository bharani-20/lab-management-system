'use strict';

const userService = require('../services/userService');
const { sendSuccess } = require('../utils/response');

async function listUsers(req, res, next) {
  try {
    const result = await userService.listUsers(req.query);
    return sendSuccess(res, result.users, 'Users retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    return sendSuccess(res, user, 'User retrieved.');
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    return sendSuccess(res, user, 'User created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user);
    return sendSuccess(res, user, 'User updated successfully.');
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    await userService.deleteUser(req.params.id, req.user);
    return sendSuccess(res, null, 'User deleted successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
