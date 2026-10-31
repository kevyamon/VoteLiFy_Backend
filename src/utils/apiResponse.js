import { HTTP_STATUS } from '../config/constants.js';

/**
 * Standardisation des réponses HTTP positives.
 * 
 * @param {import('express').Response} res
 * @param {*} data - Données utiles à transmettre
 * @param {string} [message] - Message explicatif optionnel
 * @param {number} [statusCode] - Code HTTP (défaut: 200)
 */
export const sendSuccess = (res, data = null, message = 'Opération réussie.', statusCode = HTTP_STATUS.OK) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Standardisation des réponses HTTP d'erreur.
 * 
 * @param {import('express').Response} res
 * @param {string} message - Message explicatif de l'erreur
 * @param {number} [statusCode] - Code HTTP d'erreur (défaut: 400)
 * @param {*} [errors] - Détails d'erreurs éventuels (ex: validation Zod)
 * @param {string} [code] - Code d'erreur textuel normalisé
 */
export const sendError = (
  res,
  message = 'Une erreur est survenue lors du traitement.',
  statusCode = HTTP_STATUS.BAD_REQUEST,
  errors = null,
  code = 'OPERATION_FAILED'
) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (errors) {
    payload.error.details = errors;
  }

  return res.status(statusCode).json(payload);
};
