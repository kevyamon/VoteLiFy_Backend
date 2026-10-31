import { Candidate, Position, Vote } from '../models/index.js';
import { getElectionSettings, isCandidacyPeriodActive } from '../services/election.service.js';
import { normalizePhoneNumber } from '../services/voter.service.js';
import { isValidVideoUrl, getApprovedCandidatesGroupedByPosition } from '../services/candidate.service.js';
import { recordAuditLog } from '../services/audit.service.js';
import { CANDIDATE_STATUS, AUDIT_ACTIONS, HTTP_STATUS } from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Récupération publique des candidats validés, regroupés par poste électoral.
 */
export const getPublicCandidates = async (req, res) => {
  const groupedCandidates = await getApprovedCandidatesGroupedByPosition();

  return sendSuccess(
    res,
    groupedCandidates,
    'Liste publique des candidatures approuvées récupérée avec succès.'
  );
};

/**
 * Consultation publique de la fiche détaillée d'un candidat approuvé.
 */
export const getPublicCandidateById = async (req, res) => {
  const { id } = req.params;

  const candidate = await Candidate.findOne({
    _id: id,
    status: CANDIDATE_STATUS.APPROVED,
  })
    .populate('positionId', 'name description order')
    .select('fullName positionId photoUrl pitch videoUrl createdAt')
    .lean();

  if (!candidate) {
    return sendError(
      res,
      'Candidat introuvable ou non encore approuvé par la Commission Électorale.',
      HTTP_STATUS.NOT_FOUND,
      null,
      'CANDIDATE_NOT_AVAILABLE'
    );
  }

  return sendSuccess(res, candidate, 'Fiche du candidat récupérée.');
};

/**
 * Dépôt public d'une candidature.
 * Contrôle la période, normalise le WhatsApp, valide l'unicité et la conformité des médias.
 */
export const submitCandidacy = async (req, res) => {
  // 1. Vérification stricte de l'ouverture de la période de candidature
  const settings = await getElectionSettings();
  if (!isCandidacyPeriodActive(settings)) {
    return sendError(
      res,
      'La période de dépôt des candidatures est actuellement fermée.',
      HTTP_STATUS.BAD_REQUEST,
      null,
      'CANDIDACIES_CLOSED'
    );
  }

  const { fullName, phone, positionId, photoUrl, pitch, videoUrl } = req.body;

  // 2. Normalisation du numéro WhatsApp
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return sendError(
      res,
      'Le numéro WhatsApp fourni est invalide. Veuillez saisir un numéro complet avec indicatif.',
      HTTP_STATUS.BAD_REQUEST,
      null,
      'INVALID_PHONE_NUMBER'
    );
  }

  // 3. Vérification de la validité du poste convoité
  const position = await Position.findOne({ _id: positionId, isActive: true });
  if (!position) {
    return sendError(
      res,
      'Le poste électoral sélectionné est inexistant ou désactivé.',
      HTTP_STATUS.BAD_REQUEST,
      null,
      'INVALID_POSITION'
    );
  }

  // 4. Règle d'unicité : un membre ne peut soumettre qu'une seule candidature au total
  const existingCandidate = await Candidate.findOne({ phone: normalizedPhone });
  if (existingCandidate) {
    return sendError(
      res,
      'Une candidature a déjà été enregistrée avec ce numéro WhatsApp. Il est formellement interdit de postuler à plusieurs postes simultanément.',
      HTTP_STATUS.CONFLICT,
      null,
      'CANDIDACY_ALREADY_EXISTS'
    );
  }

  // 5. Contrôle du lien vidéo si fourni
  if (videoUrl && !isValidVideoUrl(videoUrl)) {
    return sendError(
      res,
      'Le lien vidéo doit être une adresse valide hébergée sur YouTube, Google Drive ou Vimeo.',
      HTTP_STATUS.BAD_REQUEST,
      null,
      'INVALID_VIDEO_URL'
    );
  }

  // 6. Enregistrement en base de données avec statut PENDING
  const candidate = await Candidate.create({
    fullName: fullName.trim(),
    phone: normalizedPhone,
    positionId,
    photoUrl: photoUrl.trim(),
    pitch: pitch.trim(),
    videoUrl: videoUrl ? videoUrl.trim() : '',
    status: CANDIDATE_STATUS.PENDING,
  });

  // 7. Traçabilité d'audit
  await recordAuditLog({
    action: AUDIT_ACTIONS.CANDIDACY_SUBMITTED,
    targetType: 'Candidate',
    targetId: String(candidate._id),
    metadata: {
      fullName: candidate.fullName,
      positionName: position.name,
    },
    req,
  });

  return sendSuccess(
    res,
    {
      id: candidate._id,
      fullName: candidate.fullName,
      status: candidate.status,
    },
    'Votre candidature a été enregistrée avec succès. Elle sera visible sur la plateforme après validation par la Commission Électorale.',
    HTTP_STATUS.CREATED
  );
};

/**
 * Récupération de l'ensemble des candidatures pour le back-office d'administration.
 */
export const getAllCandidatesAdmin = async (req, res) => {
  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.positionId) {
    filter.positionId = req.query.positionId;
  }

  if (req.query.search) {
    const searchRegex = { $regex: req.query.search.trim(), $options: 'i' };
    filter.$or = [{ fullName: searchRegex }, { phone: searchRegex }];
  }

  const candidates = await Candidate.find(filter)
    .populate('positionId', 'name order')
    .populate('reviewedBy', 'username')
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, candidates, 'Liste administrative des candidatures récupérée.');
};

/**
 * Consultation détaillée d'un candidat pour la modération.
 */
export const getCandidateByIdAdmin = async (req, res) => {
  const { id } = req.params;

  const candidate = await Candidate.findById(id)
    .populate('positionId', 'name description')
    .populate('reviewedBy', 'username')
    .lean();

  if (!candidate) {
    return sendError(res, 'Candidat introuvable.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_FOUND');
  }

  return sendSuccess(res, candidate, 'Dossier de candidature récupéré.');
};

/**
 * Validation officielle d'une candidature par la Commission Électorale.
 */
export const approveCandidate = async (req, res) => {
  const { id } = req.params;

  const candidate = await Candidate.findById(id);
  if (!candidate) {
    return sendError(res, 'Candidat introuvable.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_FOUND');
  }

  candidate.status = CANDIDATE_STATUS.APPROVED;
  candidate.reviewedAt = new Date();
  candidate.reviewedBy = req.admin._id;
  candidate.reviewNotes = req.body.reviewNotes || '';
  await candidate.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACY_APPROVED,
    targetType: 'Candidate',
    targetId: String(candidate._id),
    metadata: { fullName: candidate.fullName },
    req,
  });

  return sendSuccess(
    res,
    candidate,
    `La candidature de « ${candidate.fullName} » a été approuvée et est désormais visible au public.`
  );
};

/**
 * Rejet d'une candidature non conforme.
 */
export const rejectCandidate = async (req, res) => {
  const { id } = req.params;
  const { reviewNotes } = req.body;

  const candidate = await Candidate.findById(id);
  if (!candidate) {
    return sendError(res, 'Candidat introuvable.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_FOUND');
  }

  candidate.status = CANDIDATE_STATUS.REJECTED;
  candidate.reviewedAt = new Date();
  candidate.reviewedBy = req.admin._id;
  candidate.reviewNotes = reviewNotes || 'Candidature non conforme aux critères d’éligibilité.';
  await candidate.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACY_REJECTED,
    targetType: 'Candidate',
    targetId: String(candidate._id),
    metadata: {
      fullName: candidate.fullName,
      reviewNotes: candidate.reviewNotes,
    },
    req,
  });

  return sendSuccess(
    res,
    candidate,
    `La candidature de « ${candidate.fullName} » a été rejetée.`
  );
};

/**
 * Modification d'informations administratives d'une candidature (correction typo, etc.).
 */
export const updateCandidateAdmin = async (req, res) => {
  const { id } = req.params;

  if (req.body.phone) {
    req.body.phone = normalizePhoneNumber(req.body.phone) || req.body.phone;
  }

  const updatedCandidate = await Candidate.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updatedCandidate) {
    return sendError(res, 'Candidat introuvable.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_FOUND');
  }

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACY_UPDATED,
    targetType: 'Candidate',
    targetId: String(updatedCandidate._id),
    metadata: req.body,
    req,
  });

  return sendSuccess(
    res,
    updatedCandidate,
    `La fiche de « ${updatedCandidate.fullName} » a été modifiée avec succès.`
  );
};

/**
 * Suppression contrôlée d'une candidature.
 * Empêche la suppression si des suffrages ont déjà été enregistrés pour ce candidat.
 */
export const deleteCandidateAdmin = async (req, res) => {
  const { id } = req.params;

  const votesCount = await Vote.countDocuments({ candidateId: id });
  if (votesCount > 0) {
    return sendError(
      res,
      `Action impossible : ${votesCount} suffrage(s) ont déjà été enregistrés pour ce candidat. Rejetez-le plutôt afin de préserver l'intégrité du scrutin.`,
      HTTP_STATUS.BAD_REQUEST,
      null,
      'CANDIDATE_HAS_VOTES'
    );
  }

  const candidate = await Candidate.findByIdAndDelete(id);
  if (!candidate) {
    return sendError(res, 'Candidat introuvable.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_FOUND');
  }

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACY_DELETED,
    targetType: 'Candidate',
    targetId: id,
    metadata: { fullName: candidate.fullName },
    req,
  });

  return sendSuccess(
    res,
    null,
    `La candidature de « ${candidate.fullName} » a été définitivement supprimée.`
  );
};
