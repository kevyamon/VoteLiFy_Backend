import { ElectionSettings } from '../models/index.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Service centralisant la logique métier des périodes électorales et de leurs transitions.
 */

/**
 * Récupère l'instance unique des paramètres du scrutin (Singleton).
 * 
 * @returns {Promise<import('../models/ElectionSettings.model.js').ElectionSettings>}
 */
export const getElectionSettings = async () => {
  return ElectionSettings.getSettings();
};

/**
 * Évalue si le scrutin de vote est actuellement en cours d'exécution.
 * 
 * @param {Object} settings
 * @returns {boolean}
 */
export const isVotingPeriodActive = (settings) => {
  if (!settings.votingOpen) return false;
  const now = new Date();
  if (settings.votingStartAt && now < new Date(settings.votingStartAt)) return false;
  if (settings.votingEndAt && now > new Date(settings.votingEndAt)) return false;
  return true;
};

/**
 * Évalue si le dépôt des candidatures est actuellement ouvert.
 * 
 * @param {Object} settings
 * @returns {boolean}
 */
export const isCandidacyPeriodActive = (settings) => {
  if (!settings.candidatePeriodOpen) return false;
  const now = new Date();
  if (settings.candidateStartAt && now < new Date(settings.candidateStartAt)) return false;
  if (settings.candidateEndAt && now > new Date(settings.candidateEndAt)) return false;
  return true;
};

/**
 * Valide et applique la publication officielle des résultats.
 * Règle stricte du CDC : Impossible de publier les résultats si le vote est encore ouvert.
 * 
 * @param {Object} settings
 */
export const assertCanPublishResults = (settings) => {
  if (settings.votingOpen) {
    throw new AppError(
      'Impossible de publier les résultats alors que la période de vote est encore active. Clôturez d’abord le scrutin.',
      HTTP_STATUS.BAD_REQUEST,
      'VOTING_STILL_OPEN'
    );
  }
};
