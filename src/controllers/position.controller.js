import { Position, Candidate } from '../models/index.js';
import { HTTP_STATUS } from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Récupération de la liste publique des postes électoraux actifs.
 */
export const getPublicPositions = async (req, res) => {
  const positions = await Position.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();

  return sendSuccess(res, positions, 'Postes électoraux actifs récupérés avec succès.');
};

/**
 * Récupération exhaustive de tous les postes pour le back-office.
 */
export const getAllPositions = async (req, res) => {
  const positions = await Position.find().sort({ order: 1, name: 1 }).lean();

  return sendSuccess(res, positions, 'Tous les postes électoraux ont été récupérés.');
};

/**
 * Création d'un nouveau poste électoral par la Commission Électorale.
 */
export const createPosition = async (req, res) => {
  const newPosition = await Position.create(req.body);

  return sendSuccess(
    res,
    newPosition,
    `Le poste « ${newPosition.name} » a été créé avec succès.`,
    HTTP_STATUS.CREATED
  );
};

/**
 * Modification d'un poste existant.
 */
export const updatePosition = async (req, res) => {
  const { id } = req.params;

  const updatedPosition = await Position.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updatedPosition) {
    return sendError(res, 'Poste électoral introuvable.', HTTP_STATUS.NOT_FOUND, null, 'POSITION_NOT_FOUND');
  }

  return sendSuccess(
    res,
    updatedPosition,
    `Le poste « ${updatedPosition.name} » a été mis à jour avec succès.`
  );
};

/**
 * Suppression d'un poste électoral avec protection de cohérence référentielle.
 */
export const deletePosition = async (req, res) => {
  const { id } = req.params;

  // Contrôle préalable : interdire la suppression si des candidatures y sont rattachées
  const candidatesCount = await Candidate.countDocuments({ positionId: id });
  if (candidatesCount > 0) {
    return sendError(
      res,
      `Impossible de supprimer ce poste : ${candidatesCount} candidature(s) y sont associées. Désactivez-le plutôt.`,
      HTTP_STATUS.BAD_REQUEST,
      null,
      'POSITION_HAS_CANDIDATES'
    );
  }

  const deletedPosition = await Position.findByIdAndDelete(id);
  if (!deletedPosition) {
    return sendError(res, 'Poste électoral introuvable.', HTTP_STATUS.NOT_FOUND, null, 'POSITION_NOT_FOUND');
  }

  return sendSuccess(res, null, `Le poste « ${deletedPosition.name} » a été supprimé avec succès.`);
};
