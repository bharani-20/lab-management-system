'use strict';

const express = require('express');
const router = express.Router();
const { sendSuccess } = require('../utils/response');

const LABS = [
  { id: 'LAB-1', code: 'LAB1', name: 'Programming Lab', systemsCount: 64, capacity: 64 },
  { id: 'LAB-2', code: 'LAB2', name: 'Networking & Security Lab', systemsCount: 64, capacity: 64 },
  { id: 'LAB-3', code: 'LAB3', name: 'AI & Data Science Lab', systemsCount: 64, capacity: 64 },
  { id: 'LAB-4', code: 'LAB4', name: 'Web Technology Lab', systemsCount: 64, capacity: 64 },
];

// GET /api/labs — Public endpoint for lab dropdown / information
router.get('/', (req, res) => {
  return sendSuccess(
    res,
    {
      labs: LABS,
      totalLabs: LABS.length,
    },
    'Labs list retrieved.'
  );
});

module.exports = router;
