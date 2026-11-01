import {
  getAllElections,
  getElectionById,
  createNewElection,
  updateElection,
} from '../services/election.service.js';
import { recordAuditLog } from '../services/audit.service.js';
import { emitSocketEvent } from '../services/socket.service.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { sendSuccess } from '../utils/apiResponse.js';

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
