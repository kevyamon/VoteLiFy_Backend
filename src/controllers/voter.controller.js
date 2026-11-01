import { Voter, ElectionSettings } from '../models/index.js';
import { previewVoters, importVotersAndGeneratePins } from '../services/voter.service.js';
import { recordAuditLog } from '../services/audit.service.js';
import { AUDIT_ACTIONS, HTTP_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';
import { emitSocketEvent } from '../services/socket.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Prévisualisation et analyse d'une liste brute de numéros sans modification de la base.
 */
export const previewVotersController = async (req, res) => {
  const { rawText } = req.body;

  const preview = await previewVoters(rawText);

  return sendSuccess(
    res,
    preview,
    `Analyse effectuée : ${preview.newToImportCount} nouvel(s) électeur(s) prêt(s) à être importé(s).`
  );
};

/**
 * Importation définitive des électeurs et génération de leurs codes PIN individuels.
 */
export const importVotersController = async (req, res) => {
  const { rawText } = req.body;

  const settings = await ElectionSettings.getSettings();

  const result = await importVotersAndGeneratePins({
    rawText,
    clientUrl: env.CLIENT_URL,
    electionTitle: settings.title,
  });

  if (result.importedCount > 0) {
    await recordAuditLog({
      adminId: req.admin._id,
      action: AUDIT_ACTIONS.VOTERS_IMPORTED,
      targetType: 'Voter',
      metadata: { importedCount: result.importedCount },
      req,
    });

    emitSocketEvent('VOTERS_IMPORTED', {
      importedCount: result.importedCount,
    });
  }

  return sendSuccess(
    res,
    result,
    `${result.importedCount} électeur(s) importé(s) et code(s) PIN généré(s) avec succès.`,
    HTTP_STATUS.CREATED
  );
};

/**
 * Récupération de la liste des électeurs enregistrés (registre d'émargement).
 * Les codes PIN ne sont jamais réaffichés en clair conformément aux règles de sécurité.
 */
export const getVotersController = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  // Filtrage par recherche de numéro
  if (req.query.search) {
    filter.phone = { $regex: req.query.search.trim(), $options: 'i' };
  }

  // Filtrage par statut de vote
  if (req.query.hasVoted !== undefined) {
    filter.hasVoted = req.query.hasVoted === 'true';
  }

  const [voters, total] = await Promise.all([
    Voter.find(filter)
      .select('phone hasVoted pinStatus votedAt createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Voter.countDocuments(filter),
  ]);

  return sendSuccess(
    res,
    {
      voters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    'Registre des électeurs récupéré avec succès.'
  );
};

/**
 * Export confidentiel des informations de suivi du scrutin (sans empreintes ni PINs).
 */
export const exportVotersController = async (req, res) => {
  const voters = await Voter.find()
    .select('phone hasVoted pinStatus votedAt createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const exportData = voters.map((v) => ({
    telephone: v.phone,
    statutVote: v.hasVoted ? 'A VOTÉ' : "N'A PAS ENCORE VOTÉ",
    dateVote: v.votedAt ? v.votedAt.toISOString() : 'N/A',
    dateImport: v.createdAt ? v.createdAt.toISOString() : 'N/A',
  }));

  return sendSuccess(res, exportData, 'Données d’export confidentiel prêtes.');
};
