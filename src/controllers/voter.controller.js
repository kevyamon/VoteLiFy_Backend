import { Voter, ElectionSettings } from '../models/index.js';
import { previewVoters, importVotersAndGeneratePins } from '../services/voter.service.js';
import { generateSinglePin, hashPin, formatWhatsAppMessage } from '../services/pin.service.js';
import { recordAuditLog } from '../services/audit.service.js';
import { AUDIT_ACTIONS, PIN_STATUS, HTTP_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';
import { emitSocketEvent } from '../services/socket.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Prévisualisation et analyse d'une liste brute de numéros sans modification de la base.
 */
export const previewVotersController = async (req, res) => {
  const { rawText, electionId } = req.body;

  const preview = await previewVoters(rawText, electionId || null);

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
  const { rawText, electionId } = req.body;

  let electionTitle = 'VoteLiFy';
  if (electionId) {
    const { Election } = await import('../models/index.js');
    const el = await Election.findById(electionId);
    if (el) electionTitle = el.title;
  } else {
    const settings = await ElectionSettings.getSettings();
    electionTitle = settings.title;
  }

  const result = await importVotersAndGeneratePins({
    rawText,
    clientUrl: env.CLIENT_URL,
    electionTitle,
    electionId: electionId || null,
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

  // Filtrage par élection
  if (req.query.electionId) {
    filter.electionId = req.query.electionId;
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
  const exportFilter = {};
  if (req.query.electionId) {
    exportFilter.electionId = req.query.electionId;
  }

  const voters = await Voter.find(exportFilter)
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

/**
 * Suppression sécurisée d'un électeur de la liste (registre d'émargement).
 * Strictement interdite si l'électeur a déjà émargé et voté.
 */
export const deleteVoterController = async (req, res) => {
  const { id } = req.params;

  const voter = await Voter.findById(id);
  if (!voter) {
    return sendError(res, 'Électeur introuvable.', HTTP_STATUS.NOT_FOUND, null, 'VOTER_NOT_FOUND');
  }

  if (voter.hasVoted) {
    return sendError(
      res,
      'Action impossible : cet électeur a déjà exprimé son vote. Son émargement est scellé pour garantir la concordance des suffrages.',
      HTTP_STATUS.BAD_REQUEST,
      null,
      'VOTER_ALREADY_VOTED'
    );
  }

  await Voter.findByIdAndDelete(id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.VOTER_DELETED,
    targetType: 'Voter',
    targetId: id,
    metadata: { phone: voter.phone },
    req,
  });

  emitSocketEvent('VOTE_CAST', { voterDeleted: true });

  return sendSuccess(res, null, `L'électeur ${voter.phone} a été retiré de la liste avec succès.`);
};

/**
 * Régénération d'un nouveau code PIN individuel pour un électeur.
 * Interdite si le vote a déjà été exprimé.
 */
export const regenerateVoterPinController = async (req, res) => {
  const { id } = req.params;

  const voter = await Voter.findById(id);
  if (!voter) {
    return sendError(res, 'Électeur introuvable.', HTTP_STATUS.NOT_FOUND, null, 'VOTER_NOT_FOUND');
  }

  if (voter.hasVoted) {
    return sendError(
      res,
      'Action impossible : cet électeur a déjà voté. Aucun nouveau code PIN ne peut être émis.',
      HTTP_STATUS.BAD_REQUEST,
      null,
      'VOTER_ALREADY_VOTED'
    );
  }

  // Génération d'un nouveau code PIN sécurisé (ex: VT-48291-K)
  const newPin = generateSinglePin();
  const newPinHash = await hashPin(newPin);

  voter.pinHash = newPinHash;
  voter.pinStatus = PIN_STATUS.ACTIVE;
  await voter.save();

  const settings = await ElectionSettings.getSettings();
  const formattedMessage = formatWhatsAppMessage({
    pin: newPin,
    clientUrl: env.CLIENT_URL || 'https://votelify.vercel.app',
    electionTitle: settings.title,
  });

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.PIN_REGENERATED,
    targetType: 'Voter',
    targetId: id,
    metadata: { phone: voter.phone },
    req,
  });

  emitSocketEvent('VOTE_CAST', { pinRegenerated: true });

  return sendSuccess(
    res,
    {
      phone: voter.phone,
      newPin,
      message: formattedMessage,
    },
    `Un nouveau code PIN a été généré avec succès pour l'électeur ${voter.phone}.`
  );
};

