import { Admin } from '../models/index.js';
import { HTTP_STATUS, SECURITY_CONFIG } from '../config/constants.js';
import { sendError } from '../utils/apiResponse.js';
import { verifyAdminToken } from '../services/token.service.js';

/**
 * Middleware d'authentification et de contrôle d'accès pour les routes de la Commission Électorale.
 * Intercepte et valide le cookie HTTP-only ou l'en-tête Authorization.
 */
export const requireAdminAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.[SECURITY_CONFIG.COOKIE_NAME];

    // Fallback : En-tête Bearer si utilisé par un client externe
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(
        res,
        'Accès non autorisé. Session administrateur absente.',
        HTTP_STATUS.UNAUTHORIZED,
        null,
        'AUTHENTICATION_REQUIRED'
      );
    }

    // Vérification de signature et d'expiration
    const decoded = verifyAdminToken(token);

    // Contrôle de l'existence et du statut actif de l'administrateur
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive) {
      return sendError(
        res,
        'Compte administrateur introuvable ou désactivé.',
        HTTP_STATUS.UNAUTHORIZED,
        null,
        'ADMIN_DISABLED'
      );
    }

    // Attachement de l'administrateur vérifié à la requête
    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(
        res,
        'Votre session administrateur a expiré. Veuillez vous reconnecter.',
        HTTP_STATUS.UNAUTHORIZED,
        null,
        'TOKEN_EXPIRED'
      );
    }

    return sendError(
      res,
      'Session d’authentification invalide.',
      HTTP_STATUS.UNAUTHORIZED,
      null,
      'INVALID_SESSION'
    );
  }
};
