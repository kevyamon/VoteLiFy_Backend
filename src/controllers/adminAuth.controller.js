import { Admin } from '../models/index.js';
import { env } from '../config/env.js';
import { HTTP_STATUS, AUDIT_ACTIONS } from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { generateAdminToken, setAdminAuthCookie, clearAdminAuthCookie } from '../services/token.service.js';
import { recordAuditLog } from '../services/audit.service.js';

/**
 * Initialisation du compte administrateur unique sous protection de la variable secrète AD_PW.
 * Verrouille définitivement toute nouvelle inscription dès que le premier compte existe.
 */
export const registerInitialAdmin = async (req, res) => {
  const { username, password, adminSecret } = req.body;

  // 1. Contrôle du verrouillage : un seul compte administrateur est autorisé
  const existingAdminCount = await Admin.countDocuments();
  if (existingAdminCount > 0) {
    return sendError(
      res,
      'Le compte administrateur initial a déjà été créé. Les inscriptions sont définitivement closes.',
      HTTP_STATUS.FORBIDDEN,
      null,
      'ADMIN_ALREADY_EXISTS'
    );
  }

  // 2. Vérification de la clé secrète d'initialisation AD_PW
  if (adminSecret !== env.AD_PW) {
    return sendError(
      res,
      "Clé secrète d'initialisation incorrecte.",
      HTTP_STATUS.FORBIDDEN,
      null,
      'INVALID_ADMIN_SECRET'
    );
  }

  // 3. Hachage du mot de passe et création du compte
  const passwordHash = await Admin.hashPassword(password);

  const newAdmin = await Admin.create({
    username: username.toLowerCase().trim(),
    passwordHash,
  });

  // 4. Traçabilité d'audit
  await recordAuditLog({
    adminId: newAdmin._id,
    action: AUDIT_ACTIONS.ADMIN_INITIALIZED,
    targetType: 'Admin',
    targetId: String(newAdmin._id),
    metadata: { username: newAdmin.username },
    req,
  });

  // 5. Génération du jeton et dépôt du cookie HttpOnly
  const token = generateAdminToken({ id: newAdmin._id, role: newAdmin.role });
  setAdminAuthCookie(res, token);

  return sendSuccess(
    res,
    {
      id: newAdmin._id,
      username: newAdmin.username,
      role: newAdmin.role,
      token,
    },
    'Compte administrateur initial créé et authentifié avec succès.',
    HTTP_STATUS.CREATED
  );
};

/**
 * Authentification de l'administrateur de la Commission Électorale.
 */
export const loginAdmin = async (req, res) => {
  const { username, password } = req.body;

  // Recherche de l'administrateur en incluant explicitement le champ passwordHash masqué
  const admin = await Admin.findOne({ username: username.toLowerCase().trim() }).select('+passwordHash');

  if (!admin) {
    return sendError(res, 'Identifiants invalides.', HTTP_STATUS.UNAUTHORIZED, null, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    return sendError(res, 'Identifiants invalides.', HTTP_STATUS.UNAUTHORIZED, null, 'INVALID_CREDENTIALS');
  }

  if (!admin.isActive) {
    return sendError(
      res,
      'Ce compte administrateur a été désactivé par sécurité.',
      HTTP_STATUS.FORBIDDEN,
      null,
      'ACCOUNT_DISABLED'
    );
  }

  // Mise à jour de l'horodatage de dernière connexion
  admin.lastLoginAt = new Date();
  await admin.save();

  // Traçabilité d'audit
  await recordAuditLog({
    adminId: admin._id,
    action: AUDIT_ACTIONS.ADMIN_LOGIN,
    targetType: 'Admin',
    targetId: String(admin._id),
    req,
  });

  // Émission du jeton sécurisé
  const token = generateAdminToken({ id: admin._id, role: admin.role });
  setAdminAuthCookie(res, token);

  return sendSuccess(
    res,
    {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
      token,
    },
    'Connexion réussie à l’espace Commission Électorale.'
  );
};

/**
 * Clôture de la session d'administration et invalidation du cookie.
 */
export const logoutAdmin = async (req, res) => {
  if (req.admin) {
    await recordAuditLog({
      adminId: req.admin._id,
      action: AUDIT_ACTIONS.ADMIN_LOGOUT,
      targetType: 'Admin',
      targetId: String(req.admin._id),
      req,
    });
  }

  clearAdminAuthCookie(res);

  return sendSuccess(res, null, 'Déconnexion effectuée avec succès.');
};

/**
 * Récupération du profil de l'administrateur actuellement connecté.
 */
export const getMe = async (req, res) => {
  return sendSuccess(
    res,
    {
      id: req.admin._id,
      username: req.admin.username,
      role: req.admin.role,
      lastLoginAt: req.admin.lastLoginAt,
      createdAt: req.admin.createdAt,
    },
    'Session administrateur active vérifiée.'
  );
};
