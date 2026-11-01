import {
  getAllElections,
  getElectionById,
  createNewElection,
  updateElection,
  openElectionVoting,
  closeElectionVoting,
  openElectionCandidacies,
  closeElectionCandidacies,
  publishElectionResults,
  unpublishElectionResults,
  deleteElection,
} from '../services/election.service.js';
import { uploadElectionImage } from '../services/cloudinary.service.js';
import { recordAuditLog } from '../services/audit.service.js';
import { emitSocketEvent } from '../services/socket.service.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Récupère la liste publique de toutes les élections créées sur la plateforme VoteLiFy.
 */
export const listAllElectionsController = async (req, res) => {
  const elections = await getAllElections();
  return sendSuccess(
    res,
    elections,
    'Liste officielle des scrutins disponibles récupérée avec succès.'
  );
};

/**
 * Récupère les détails publics d'un scrutin spécifique par son identifiant.
 */
export const getElectionDetailController = async (req, res) => {
  const { id } = req.params;
  const election = await getElectionById(id);
  return sendSuccess(
    res,
    election,
    'Détails du scrutin électoral récupérés avec succès.'
  );
};

/**
 * Création d'une nouvelle élection par la Commission Électorale.
 */
export const createElectionAdminController = async (req, res) => {
  const election = await createNewElection(req.body, req.admin._id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    targetType: 'Election',
    targetId: String(election._id),
    metadata: { title: election.title, createdBy: req.admin.username },
    req,
  });

  emitSocketEvent('ELECTION_CREATED', election);
  emitSocketEvent('ELECTION_UPDATED', election);

  return sendSuccess(
    res,
    election,
    `L'élection « ${election.title} » a été créée avec succès.`
  );
};

/**
 * Mise à jour des paramètres ou dates d'une élection.
 */
export const updateElectionAdminController = async (req, res) => {
  const { id } = req.params;
  const election = await updateElection(id, req.body);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    targetType: 'Election',
    targetId: String(election._id),
    metadata: { title: election.title, updatedBy: req.admin.username },
    req,
  });

  emitSocketEvent('ELECTION_UPDATED', election);

  return sendSuccess(
    res,
    election,
    `L'élection « ${election.title} » a été mise à jour avec succès.`
  );
};

/**
 * Ouverture officielle du vote pour un scrutin spécifique.
 */
export const openVotingAdminController = async (req, res) => {
  const { id } = req.params;
  const election = await openElectionVoting(id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.VOTING_OPENED,
    targetType: 'Election',
    targetId: String(election._id),
    metadata: { title: election.title },
    req,
  });

  emitSocketEvent('ELECTION_UPDATED', election);

  return sendSuccess(
    res,
    election,
    `Le scrutin « ${election.title} » est officiellement ouvert pour 48 heures.`
  );
};

/**
 * Clôture officielle du vote pour un scrutin spécifique.
 */
export const closeVotingAdminController = async (req, res) => {
  const { id } = req.params;
  const election = await closeElectionVoting(id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.VOTING_CLOSED,
    targetType: 'Election',
    targetId: String(election._id),
    metadata: { title: election.title },
    req,
  });

  emitSocketEvent('ELECTION_UPDATED', election);

  return sendSuccess(
    res,
    election,
    `Le scrutin « ${election.title} » a été clôturé avec succès.`
  );
};

/**
 * Ouverture des candidatures pour un scrutin spécifique.
 */
export const openCandidaciesAdminController = async (req, res) => {
  const { id } = req.params;
  const election = await openElectionCandidacies(id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACIES_OPENED,
    targetType: 'Election',
    targetId: String(election._id),
    metadata: { title: election.title },
    req,
  });

  emitSocketEvent('ELECTION_UPDATED', election);

  return sendSuccess(
    res,
    election,
    `Le dépôt des candidatures pour « ${election.title} » est désormais ouvert.`
  );
};

/**
 * Clôture des candidatures pour un scrutin spécifique.
 */
export const closeCandidaciesAdminController = async (req, res) => {
  const { id } = req.params;
  const election = await closeElectionCandidacies(id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACIES_CLOSED,
    targetType: 'Election',
    targetId: String(election._id),
    metadata: { title: election.title },
    req,
  });

  emitSocketEvent('ELECTION_UPDATED', election);

  return sendSuccess(
    res,
    election,
    `Le dépôt des candidatures pour « ${election.title} » a été clôturé.`
  );
};

/**
 * Proclamation officielle et publication des résultats pour un scrutin spécifique.
 */
export const publishResultsAdminController = async (req, res) => {
  const { id } = req.params;
  const election = await publishElectionResults(id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.RESULTS_PUBLISHED,
    targetType: 'Election',
    targetId: String(election._id),
    metadata: { title: election.title },
    req,
  });

  emitSocketEvent('ELECTION_UPDATED', election);

  return sendSuccess(
    res,
    election,
    `Les résultats du scrutin « ${election.title} » sont désormais officiellement proclamés.`
  );
};

/**
 * Suspension de la proclamation des résultats pour un scrutin spécifique.
 */
export const unpublishResultsAdminController = async (req, res) => {
  const { id } = req.params;
  const election = await unpublishElectionResults(id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.RESULTS_UNPUBLISHED,
    targetType: 'Election',
    targetId: String(election._id),
    metadata: { title: election.title },
    req,
  });

  emitSocketEvent('ELECTION_UPDATED', election);

  return sendSuccess(
    res,
    election,
    `La publication des résultats pour « ${election.title} » a été suspendue.`
  );
};

/**
 * Téléversement et mise à jour de l'image d'illustration Cloudinary pour une élection.
 */
export const uploadElectionImageAdminController = async (req, res) => {
  const { id } = req.params;
  const { image } = req.body;

  if (!image) {
    return sendError(res, 'Aucune image fournie.', 400);
  }

  const election = await getElectionById(id);
  const secureUrl = await uploadElectionImage(image, election.title);
  const updatedElection = await updateElection(id, { imageUrl: secureUrl });

  emitSocketEvent('ELECTION_UPDATED', updatedElection);

  return sendSuccess(
    res,
    updatedElection,
    `L'image d'illustration pour « ${updatedElection.title} » a été téléversée avec succès.`
  );
};

/**
 * Suppression sécurisée d'une élection.
 */
export const deleteElectionAdminController = async (req, res) => {
  const { id } = req.params;
  const result = await deleteElection(id);

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    targetType: 'Election',
    targetId: String(id),
    metadata: { action: 'DELETE_ELECTION', title: result.title },
    req,
  });

  emitSocketEvent('ELECTION_UPDATED', { _id: id, deleted: true });

  return sendSuccess(
    res,
    result,
    `L'élection « ${result.title} » a été supprimée avec succès.`
  );
};
