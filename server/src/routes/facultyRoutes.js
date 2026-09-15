'use strict';

const express = require('express');
const router = express.Router();
const { FACULTY_MEMBERS } = require('../utils/constants');
const { sendSuccess } = require('../utils/response');

// GET /api/faculty — Public endpoint for populating student client faculty dropdown
router.get('/', (req, res) => {
  const formatted = FACULTY_MEMBERS.map((name, index) => ({
    id: `FAC_${index + 1}`,
    name,
  }));

  return sendSuccess(
    res,
    {
      faculty: FACULTY_MEMBERS,
      members: formatted,
      count: FACULTY_MEMBERS.length,
    },
    'Faculty members retrieved.'
  );
});

module.exports = router;
