'use strict';

const { prisma } = require('../config/database');
const { createError } = require('../middleware/errorMiddleware');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { normalizeSystemCode } = require('../utils/systemCodeHelper');

/**
 * Generate a clean human-readable ticket ID like TICK-1726402320-1234
 */
function generateTicketId() {
  const timestamp = Date.now();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TICK-${timestamp}-${rand}`;
}

/**
 * Create a new support ticket from student kiosk or admin.
 */
async function createTicket(data) {
  const {
    systemNumber,
    systemCode: rawSystemCode,
    systemId,
    category,
    description,
  } = data;

  const codeInput = systemNumber || rawSystemCode;
  const systemCode = codeInput ? normalizeSystemCode(codeInput) : null;

  let targetSystemId = systemId || null;
  if (!targetSystemId && systemCode) {
    const sys = await prisma.system.findFirst({
      where: {
        OR: [{ systemCode }, { systemCode: codeInput }],
      },
    });
    if (sys) {
      targetSystemId = sys.id;
    }
  }

  const ticketId = generateTicketId();

  return prisma.ticket.create({
    data: {
      ticketId,
      systemId: targetSystemId,
      systemCode: systemCode || codeInput || null,
      category,
      description,
      status: 'OPEN',
      reportedAt: new Date(),
    },
    include: {
      system: { select: { id: true, systemCode: true, hostname: true } },
    },
  });
}

/**
 * List tickets with filters and pagination.
 */
async function listTickets(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { status, systemCode, category, search } = query;

  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (systemCode) {
    const normalized = normalizeSystemCode(systemCode);
    where.OR = [
      { systemCode: normalized },
      { systemCode },
    ];
  }
  if (search) {
    where.OR = [
      { ticketId: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { systemCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { reportedAt: 'desc' },
      include: {
        system: { select: { id: true, systemCode: true, hostname: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    tickets,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Get ticket by ID or ticketId.
 */
async function getTicketById(id) {
  let ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      system: { select: { id: true, systemCode: true, hostname: true } },
    },
  });

  if (!ticket) {
    ticket = await prisma.ticket.findUnique({
      where: { ticketId: id },
      include: {
        system: { select: { id: true, systemCode: true, hostname: true } },
      },
    });
  }

  if (!ticket) {
    throw createError('Ticket not found.', 404, 'TICKET_NOT_FOUND');
  }

  return ticket;
}

/**
 * Update ticket status (OPEN, IN_PROGRESS, RESOLVED, CLOSED).
 */
async function updateTicketStatus(id, status) {
  const ticket = await getTicketById(id);

  const updateData = { status };
  if (status === 'RESOLVED' || status === 'CLOSED') {
    updateData.resolvedAt = new Date();
  }

  return prisma.ticket.update({
    where: { id: ticket.id },
    data: updateData,
    include: {
      system: { select: { id: true, systemCode: true, hostname: true } },
    },
  });
}

module.exports = {
  createTicket,
  listTickets,
  getTicketById,
  updateTicketStatus,
};
