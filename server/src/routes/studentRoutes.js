'use strict';

const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createStudentSchema, updateStudentSchema } = require('../validators/studentValidator');
const { USER_ROLE } = require('../utils/constants');

// All student routes require authentication
router.use(authenticate);

// Student presence view (accessible by ADMIN, FACULTY, NON_TEACHING_STAFF)
router.get('/presence', studentController.getStudentPresence);

// List and single student (accessible by ADMIN, FACULTY, NON_TEACHING_STAFF)
router.get('/', studentController.listStudents);
router.get('/:id', studentController.getStudentById);

// Admin-only CRUD operations
router.post('/', authorize(USER_ROLE.ADMIN), validate(createStudentSchema), studentController.createStudent);
router.put('/:id', authorize(USER_ROLE.ADMIN), validate(updateStudentSchema), studentController.updateStudent);
router.delete('/:id', authorize(USER_ROLE.ADMIN), studentController.deleteStudent);

module.exports = router;
