import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { SECURITY_CONFIG } from '../config/constants.js';

/**
 * Génère un jeton JWT d'authentification administrative signé.
 * 
 * @param {Object} payload - Données contenues dans le jeton ({ id, role })
 * @returns {string} Jeton JWT signé
 */
export const generateAdminToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: `${env.ADMIN_SESSION_HOURS}h`,
  });
};

/**
 * Vérifie et décode un jeton JWT d'authentification.
 * 
 * @param {string} token
 * @returns {Object} Payload décodé
 */
export const verifyAdminToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Injecte le jeton dans un cookie HTTP-only blindé.
 * 
 * @param {import('express').Response} res
 * @param {string} token
 */
export const setAdminAuthCookie = (res, token) => {
  const maxAgeMs = env.ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const isProd = env.NODE_ENV === 'production';

  res.cookie(SECURITY_CONFIG.COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: maxAgeMs,
    path: '/',
  });
};

/**
 * Supprime le cookie de session lors de la déconnexion.
 * 
 * @param {import('express').Response} res
 */
export const clearAdminAuthCookie = (res) => {
  const isProd = env.NODE_ENV === 'production';

  res.clearCookie(SECURITY_CONFIG.COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
};
