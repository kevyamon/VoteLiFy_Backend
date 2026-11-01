import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Configuration stricte de CORS basée sur l'environnement.
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (ex: curl, Postman ou requêtes serveur à serveur)
    if (!origin) return callback(null, true);

    const clientUrlClean = (env.CLIENT_URL || '').trim().replace(/\/+$/, '');

    // 1. Autoriser localhost et adresses réseau local pour le développement et les tests mobiles
    if (
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    // 2. Autoriser CLIENT_URL configuré
    if (clientUrlClean && origin === clientUrlClean) {
      return callback(null, true);
    }

    // 3. Autoriser les domaines et déploiements Vercel
    if (origin.endsWith('.vercel.app') || origin === 'https://votelify.vercel.app') {
      return callback(null, true);
    }

    // Rejeter proprement sans déclencher de crash serveur 500
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control'],
});

/**
 * Configuration des en-têtes sécurisés Helmet.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
});

/**
 * Limiteur global de requêtes pour prévenir les saturations d'API.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Trop grand nombre de requêtes. Veuillez patienter avant de renouveler votre tentative.',
    },
  },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

/**
 * Limiteur drastique appliqué sur les routes sensibles (Authentification & Vote).
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 essais maximum
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Nombre maximal de tentatives dépassé pour cette opération sensible. Réessayez dans 15 minutes.',
    },
  },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});
