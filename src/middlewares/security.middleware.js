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
    // Autoriser les requêtes sans origine (ex: curl, applications mobiles ou requêtes serveur à serveur)
    if (!origin) return callback(null, true);

    const clientUrlClean = (env.CLIENT_URL || '').replace(/\/+$/, '');

    // Autoriser CLIENT_URL configuré, domaines Vercel officiels ou localhost en dev
    if (
      origin === clientUrlClean ||
      origin.endsWith('.vercel.app') ||
      origin === 'https://votelify.vercel.app'
    ) {
      return callback(null, true);
    }

    if (env.NODE_ENV === 'development') {
      if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        return callback(null, true);
      }
    }

    return callback(new Error(`Origine ${origin} non autorisée par la politique CORS.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
