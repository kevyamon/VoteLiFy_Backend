import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { HTTP_STATUS } from '../config/constants.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Classe personnalisée pour les erreurs métier intentionnelles.
 */
export class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware centralisé d'interception et de formatage des erreurs.
 * Protège le serveur contre les fuites de données sensibles ou de traces en production.
 */
export const errorHandler = (err, req, res, _next) => {
  // 1. Erreurs de validation de schéma Zod
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((errorItem) => ({
      field: errorItem.path.join('.'),
      message: errorItem.message,
    }));
    return sendError(
      res,
      'Les données transmises sont incomplètes ou non conformes.',
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      formattedErrors,
      'VALIDATION_ERROR'
    );
  }

  // 2. Erreurs de contrainte d'unicité MongoDB (Code 11000)
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyValue || {})[0] || 'champ';
    return sendError(
      res,
      `Une ressource existe déjà avec cette valeur pour le champ : ${duplicateField}.`,
      HTTP_STATUS.CONFLICT,
      null,
      'DUPLICATE_ENTRY'
    );
  }

  // 3. Erreurs de transtypage MongoDB (ex: ObjectId invalide)
  if (err.name === 'CastError') {
    return sendError(
      res,
      `Identifiant de ressource invalide pour : ${err.path}.`,
      HTTP_STATUS.BAD_REQUEST,
      null,
      'INVALID_IDENTIFIER'
    );
  }

  // 4. Erreurs de validation Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendError(
      res,
      'Erreur de validation de persistance.',
      HTTP_STATUS.BAD_REQUEST,
      errors,
      'PERSISTENCE_VALIDATION_ERROR'
    );
  }

  // 5. Erreurs de jetons JWT
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Session invalide ou corrompue.', HTTP_STATUS.UNAUTHORIZED, null, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Votre session a expiré. Veuillez vous reconnecter.', HTTP_STATUS.UNAUTHORIZED, null, 'TOKEN_EXPIRED');
  }

  // 6. Erreurs applicatives contrôlées
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, null, err.code);
  }

  // 7. Erreurs internes inattendues (Code 500)
  if (env.NODE_ENV !== 'production') {
    console.error('💥 Erreur interne non gérée :', err);
  } else {
    console.error('💥 Erreur interne non gérée :', err.message);
  }

  const productionMessage = 'Une défaillance technique inattendue est survenue. Veuillez réessayer ultérieurement.';
  const devMessage = err.message || productionMessage;

  return sendError(
    res,
    env.NODE_ENV === 'production' ? productionMessage : devMessage,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    env.NODE_ENV === 'production' ? null : { stack: err.stack },
    'INTERNAL_SERVER_ERROR'
  );
};
