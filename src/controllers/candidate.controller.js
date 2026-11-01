import { Candidate, Position, Vote, Election } from '../models/index.js';
import { getElectionSettings, isCandidacyPeriodActive } from '../services/election.service.js';
import { normalizePhoneNumber } from '../services/voter.service.js';
import {
  isValidVideoUrl,
  getApprovedCandidatesGroupedByPosition,
  resolveCandidateEmailContext,
  checkDuplicateCandidacy,
} from '../services/candidate.service.js';
import { uploadCandidatePhoto } from '../services/cloudinary.service.js';
import { recordAuditLog } from '../services/audit.service.js';
import { CANDIDATE_STATUS, AUDIT_ACTIONS, HTTP_STATUS } from '../config/constants.js';
import { emitSocketEvent } from '../services/socket.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  sendCandidacySubmittedEmail,
  sendCandidacyApprovedEmail,
  sendCandidacyRejectedEmail,
} from '../services/email.service.js';

/**
 * Récupération publique des candidats validés, regroupés par poste électoral.
 */
export const getPublicCandidates = async (req, res) => {
  const electionId = req.query.electionId || null;
  const groupedCandidates = await getApprovedCandidatesGroupedByPosition(electionId);

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
  const candidate = await Candidate.findOne({ _id: req.params.id, status: CANDIDATE_STATUS.APPROVED })
    .populate('positionId', 'name description order')
    .select('fullName positionId photoUrl pitch videoUrl createdAt')
    .lean();

  if (!candidate) {
    return sendError(res, 'Candidat introuvable ou non approuvé.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_AVAILABLE');
  }

  return sendSuccess(res, candidate, 'Fiche du candidat récupérée.');
};

/**
 * Dépôt public d'une candidature.
 * Contrôle la période, normalise le WhatsApp, valide l'unicité et la conformité des médias.
 */
export const submitCandidacy = async (req, res) => {
  const { fullName, phone, email, positionId, photoUrl, pitch, videoUrl, electionId } = req.body;

  // 1. Vérification de la validité du poste convoité
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

  // 2. Détermination et résolution de l'élection cible
  const targetElectionId = electionId || position.electionId || null;
  const election = (targetElectionId && await Election.findById(targetElectionId))
    || await Election.findOne({ isActive: true }).sort({ createdAt: -1 })
    || await getElectionSettings();

  // 3. Contrôle de l'ouverture de la période de candidature pour ce scrutin
  if (!isCandidacyPeriodActive(election)) {
    return sendError(
      res,
      'La période de dépôt des candidatures est actuellement fermée pour ce scrutin.',
      HTTP_STATUS.BAD_REQUEST,
      null,
      'CANDIDACIES_CLOSED'
    );
  }

  // 4. Normalisation du numéro WhatsApp
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

  // 5. Règle d'unicité : un membre ne peut soumettre qu'une seule candidature par scrutin
  const targetId = election?._id || targetElectionId || null;
  const duplicate = await checkDuplicateCandidacy({
    phone: normalizedPhone,
    electionId: targetId,
  });

  if (duplicate) {
    return sendError(
      res,
      'Une candidature a déjà été enregistrée avec ce numéro WhatsApp pour ce scrutin.',
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

  // 6. Téléversement et optimisation Cloudinary de la photo officielle
  const processedPhotoUrl = photoUrl && (photoUrl.startsWith('data:image/') || !photoUrl.includes('cloudinary.com'))
    ? await uploadCandidatePhoto(photoUrl, fullName.trim())
    : photoUrl.trim();

  // 7. Enregistrement en base de données avec statut PENDING
  const candidate = await Candidate.create({
    fullName: fullName.trim(),
    phone: normalizedPhone,
    email: email ? email.trim().toLowerCase() : '',
    electionId: election?._id || targetElectionId || null,
    positionId,
    photoUrl: processedPhotoUrl,
    pitch: pitch.trim(),
    videoUrl: videoUrl ? videoUrl.trim() : '',
    status: CANDIDATE_STATUS.PENDING,
  });

  // 8. Traçabilité d'audit
  await recordAuditLog({
    action: AUDIT_ACTIONS.CANDIDACY_SUBMITTED,
    targetType: 'Candidate',
    targetId: String(candidate._id),
    metadata: {
      fullName: candidate.fullName,
      positionName: position.name,
      electionId: election?._id || targetElectionId || null,
    },
    req,
  });

  emitSocketEvent('CANDIDATE_CREATED', {
    id: candidate._id,
    fullName: candidate.fullName,
    positionId: candidate.positionId,
  });

  // 9. Envoi d'accusé de réception automatique par email (Brevo)
  sendCandidacySubmittedEmail({
    candidate,
    electionTitle: election?.title || 'Scrutin officiel',
    positionName: position.name,
  }).catch((emailErr) => {
    console.error('[EmailService] Erreur lors de l’envoi de l’accusé de réception :', emailErr.message);
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
  const { status, positionId, electionId, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (positionId) filter.positionId = positionId;
  if (electionId) filter.electionId = electionId;
  if (search) {
    const searchRegex = { $regex: search.trim(), $options: 'i' };
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
  const candidate = await Candidate.findById(req.params.id)
    .populate('positionId', 'name description')
    .populate('reviewedBy', 'username')
    .lean();

  if (!candidate) return sendError(res, 'Candidat introuvable.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_FOUND');
  return sendSuccess(res, candidate, 'Dossier de candidature récupéré.');
};

/**
 * Validation officielle d'une candidature par la Commission Électorale.
 */
export const approveCandidate = async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) return sendError(res, 'Candidat introuvable.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_FOUND');

  Object.assign(candidate, {
    status: CANDIDATE_STATUS.APPROVED,
    reviewedAt: new Date(),
    reviewedBy: req.admin._id,
    reviewNotes: req.body.reviewNotes || '',
  });
  await candidate.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACY_APPROVED,
    targetType: 'Candidate',
    targetId: String(candidate._id),
    metadata: { fullName: candidate.fullName },
    req,
  });

  emitSocketEvent('CANDIDATE_UPDATED', candidate);

  // Notification asynchrone par email de la validation de candidature (Brevo)
  resolveCandidateEmailContext(candidate).then(({ electionTitle, positionName }) => {
    sendCandidacyApprovedEmail({ candidate, electionTitle, positionName }).catch((err) => {
      console.error('[EmailService] Erreur notification approbation candidature :', err.message);
    });
  }).catch(() => {});

  return sendSuccess(res, candidate, `La candidature de « ${candidate.fullName} » a été approuvée et est désormais visible au public.`);
};

/**
 * Rejet d'une candidature non conforme.
 */
export const rejectCandidate = async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) return sendError(res, 'Candidat introuvable.', HTTP_STATUS.NOT_FOUND, null, 'CANDIDATE_NOT_FOUND');

  Object.assign(candidate, {
    status: CANDIDATE_STATUS.REJECTED,
    reviewedAt: new Date(),
    reviewedBy: req.admin._id,
    reviewNotes: req.body.reviewNotes || 'Candidature non conforme aux critères d’éligibilité.',
  });
  await candidate.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACY_REJECTED,
    targetType: 'Candidate',
    targetId: String(candidate._id),
    metadata: { fullName: candidate.fullName, reviewNotes: candidate.reviewNotes },
    req,
  });

  emitSocketEvent('CANDIDATE_UPDATED', candidate);

  // Notification asynchrone par email du rejet de la candidature (Brevo)
  resolveCandidateEmailContext(candidate).then(({ electionTitle, positionName }) => {
    sendCandidacyRejectedEmail({
      candidate,
      electionTitle,
      positionName,
      reason: candidate.reviewNotes,
    }).catch((err) => {
      console.error('[EmailService] Erreur notification rejet candidature :', err.message);
    });
  }).catch(() => {});

  return sendSuccess(res, candidate, `La candidature de « ${candidate.fullName} » a été rejetée.`);
};

/**
 * Modification d'informations administratives d'une candidature (correction typo, etc.).
 */
export const updateCandidateAdmin = async (req, res) => {
  const { id } = req.params;

  if (req.body.phone) {
    req.body.phone = normalizePhoneNumber(req.body.phone) || req.body.phone;
  }

  if (req.body.photoUrl && req.body.photoUrl.startsWith('data:image/')) {
    req.body.photoUrl = await uploadCandidatePhoto(req.body.photoUrl, req.body.fullName || '');
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

  emitSocketEvent('CANDIDATE_UPDATED', updatedCandidate);

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

  emitSocketEvent('CANDIDATE_UPDATED', { _id: id, deleted: true });

  return sendSuccess(
    res,
    null,
    `La candidature de « ${candidate.fullName} » a été définitivement supprimée.`
  );
};
