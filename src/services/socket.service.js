import { Server } from 'socket.io';
import { env } from '../config/env.js';

let io = null;

/**
 * Initialisation du serveur Socket.io avec politique CORS alignée.
 * 
 * @param {import('http').Server} httpServer
 */
export const initSocket = (httpServer) => {
  const clientUrlClean = (env.CLIENT_URL || '').trim().replace(/\/+$/, '');

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        // Autoriser localhost, IP locales et domaines Vercel
        if (
          /^http:\/\/localhost(:\d+)?$/.test(origin) ||
          /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
          /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin) ||
          (clientUrlClean && origin === clientUrlClean) ||
          origin.endsWith('.vercel.app') ||
          origin === 'https://votelify.vercel.app'
        ) {
          return callback(null, true);
        }

        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Connexion client silencieuse
    socket.on('disconnect', () => {
      // Déconnexion
    });
  });

  console.log('⚡ Service WebSocket Socket.io initialisé.');
  return io;
};

/**
 * Émission d'un événement temps réel à tous les clients connectés.
 * 
 * @param {string} event - Nom de l'événement
 * @param {*} payload - Données transmises
 */
export const emitSocketEvent = (event, payload = {}) => {
  if (io) {
    try {
      io.emit(event, {
        ...payload,
        _timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Erreur d'émission WebSocket [${event}] :`, err);
    }
  }
};
