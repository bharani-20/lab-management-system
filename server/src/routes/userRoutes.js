'use strict';

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createUserSchema, updateUserSchema } = require('../validators/userValidator');
const { USER_ROLE } = require('../utils/constants');

// Strictly ADMIN only routes
router.use(authenticate);
router.use(authorize(USER_ROLE.ADMIN));

router.get('/', userController.listUsers);
router.get('/:id', userController.getUserById);
router.post('/', validate(createUserSchema), userController.createUser);
router.put('/:id', validate(updateUserSchema), userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
