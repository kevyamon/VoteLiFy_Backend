import { AuditLog } from '../models/index.js';

/**
 * Enregistre une opération sensible dans le journal d'audit immuable.
 * 
 * @param {Object} params
 * @param {string|null} [params.adminId] - Identifiant de l'administrateur à l'origine de l'action
 * @param {string} params.action - Constante AUDIT_ACTIONS
 * @param {string} [params.targetType] - Type de ressource ciblée
 * @param {string} [params.targetId] - Identifiant de la ressource ciblée
 * @param {Object} [params.metadata] - Métadonnées contextuelles (sans secrets)
 * @param {import('express').Request} [params.req] - Requête HTTP pour extraire IP et User-Agent
 */
export const recordAuditLog = async ({
  adminId = null,
  action,
  targetType = '',
  targetId = '',
  metadata = {},
  req = null,
}) => {
  try {
    const ipAddress = req ? req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '' : '';
    const userAgent = req ? req.headers['user-agent'] || '' : '';

    await AuditLog.create({
      adminId,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress: String(ipAddress).slice(0, 100),
      userAgent: String(userAgent).slice(0, 255),
    });
  } catch (error) {
    // La journalisation d'audit ne doit jamais bloquer le flux principal en cas d'erreur secondaire
    console.error("⚠️ Défaillance de l'enregistrement du journal d'audit :", error.message);
  }
};
