'use strict';

const { Server } = require('socket.io');
const config = require('../config/env');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize Socket.IO on the HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    logger.info('[socket] Client connected', {
      socketId: socket.id,
      origin: socket.handshake.headers.origin || 'unknown',
    });

    socket.on('disconnect', (reason) => {
      logger.info('[socket] Client disconnected', { socketId: socket.id, reason });
    });

    // Allow clients to join rooms (e.g., admin room)
    socket.on('join:admin', () => {
      socket.join('admin');
      logger.debug('[socket] Client joined admin room', { socketId: socket.id });
    });

    socket.on('join:lab', () => {
      socket.join('lab');
    });
  });

  logger.info('[socket] Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance.
 * Returns null if not yet initialized.
 * @returns {import('socket.io').Server | null}
 */
function getSocketIO() {
  return io;
}

module.exports = { initializeSocket, getSocketIO };
