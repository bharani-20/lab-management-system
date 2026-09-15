'use strict';

const ticketService = require('../services/ticketService');
const { sendSuccess } = require('../utils/response');

/**
 * POST /api/tickets
 * Public endpoint for reporting issues from student kiosk or admin.
 */
async function createTicket(req, res, next) {
  try {
    const ticket = await ticketService.createTicket(req.body);
    return sendSuccess(res, ticket, 'Ticket submitted successfully.', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tickets
 * List tickets with filters & pagination (Admin, Faculty, Staff).
 */
async function listTickets(req, res, next) {
  try {
    const result = await ticketService.listTickets(req.query);
    return sendSuccess(res, result.tickets, 'Tickets retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tickets/:id
 * Get single ticket details.
 */
async function getTicketById(req, res, next) {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    return sendSuccess(res, ticket, 'Ticket retrieved.');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tickets/:id/status or PUT /api/tickets/:id
 * Update ticket status.
 */
async function updateTicketStatus(req, res, next) {
  try {
    const { status } = req.body;
    const ticket = await ticketService.updateTicketStatus(req.params.id, status);
    return sendSuccess(res, ticket, 'Ticket status updated.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTicket,
  listTickets,
  getTicketById,
  updateTicketStatus,
};
