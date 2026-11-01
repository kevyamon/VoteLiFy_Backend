import { ElectionSettings, Election } from '../models/index.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Service centralisant la logique métier des périodes électorales et du multi-élections.
 */

/**
 * Récupère l'instance unique des paramètres du scrutin (Singleton pour rétrocompatibilité).
 * 
 * @returns {Promise<import('../models/ElectionSettings.model.js').ElectionSettings>}
 */
export const getElectionSettings = async () => {
  return ElectionSettings.getSettings();
};

/**
 * Évalue si le scrutin de vote est actuellement en cours d'exécution.
 * 
 * @param {Object} item
 * @returns {boolean}
 */
export const isVotingPeriodActive = (item) => {
  if (!item || !item.votingOpen) return false;
  const now = new Date();
  if (item.votingStartAt && now < new Date(item.votingStartAt)) return false;
  if (item.votingEndAt && now > new Date(item.votingEndAt)) return false;
  return true;
};

/**
 * Évalue si le dépôt des candidatures est actuellement ouvert.
 * 
 * @param {Object} item
 * @returns {boolean}
 */
export const isCandidacyPeriodActive = (item) => {
  if (!item || !item.candidatePeriodOpen) return false;
  const now = new Date();
  if (item.candidateStartAt && now < new Date(item.candidateStartAt)) return false;
  if (item.candidateEndAt && now > new Date(item.candidateEndAt)) return false;
  return true;
};

/**
 * Valide et applique la publication officielle des résultats.
 * Règle stricte du CDC : Impossible de publier les résultats si le vote est encore ouvert.
 * 
 * @param {Object} item
 */
export const assertCanPublishResults = (item) => {
  if (item?.votingOpen) {
    throw new AppError(
      'Impossible de publier les résultats alors que la période de vote est encore active. Clôturez d’abord le scrutin.',
      HTTP_STATUS.BAD_REQUEST,
      'VOTING_STILL_OPEN'
    );
  }
};

/**
 * Calcule les initiales (2 premières lettres) pour l'illustration de la carte.
 * 
 * @param {string} title
 * @returns {string}
 */
export const getElectionInitials = (title) => {
  if (!title) return 'EL';
  const clean = title.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '');
  return clean.slice(0, 2).toUpperCase() || 'EL';
};

/**
 * Formate une élection avec ses statuts temporels calculés en direct.
 */
export const formatElection = (election) => {
  const isVotingActive = isVotingPeriodActive(election);
  const isCandidacyActive = isCandidacyPeriodActive(election);
  const initials = getElectionInitials(election.title);

  // Détermination du statut textuel clair pour l'UI
  let statusKey = 'draft';
  let statusLabel = 'En préparation';

  if (election.resultsPublished) {
    statusKey = 'results_published';
    statusLabel = 'Résultats proclamés';
  } else if (isVotingActive) {
    statusKey = 'voting_open';
    statusLabel = 'Vote en cours';
  } else if (isCandidacyActive) {
    statusKey = 'candidacy_open';
    statusLabel = 'Candidatures ouvertes';
  } else if (election.votingEndAt && new Date() > new Date(election.votingEndAt)) {
    statusKey = 'voting_closed';
    statusLabel = 'Scrutin clos';
  }

  return {
    _id: election._id,
    title: election.title,
    description: election.description || '',
    initials,
    statusKey,
    statusLabel,
    timezone: election.timezone || 'Africa/Abidjan',
    voting: {
      isOpen: isVotingActive,
      startAt: election.votingStartAt,
      endAt: election.votingEndAt,
    },
    candidacies: {
      isOpen: isCandidacyActive,
      startAt: election.candidateStartAt,
      endAt: election.candidateEndAt,
    },
    results: {
      isPublished: Boolean(election.resultsPublished),
      publishAt: election.resultsPublishAt,
    },
    createdAt: election.createdAt,
    updatedAt: election.updatedAt,
  };
};

/**
 * Récupère l'ensemble des élections disponibles pour affichage sur la page des élections.
 */
export const getAllElections = async () => {
  await Election.ensureDefaultElection();
  const elections = await Election.find({ isActive: true }).sort({ createdAt: -1 });
  return elections.map(formatElection);
};

/**
 * Récupère une élection par son identifiant.
 */
export const getElectionById = async (id) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }
  return formatElection(election);
};

/**
 * Création d'une nouvelle élection par l'administrateur.
 */
export const createNewElection = async (data, adminId) => {
  const election = await Election.create({
    ...data,
    createdBy: adminId,
    // Si des dates de vote sont fournies, déduire l'état d'ouverture
    votingOpen: Boolean(data.votingOpen),
    candidatePeriodOpen: Boolean(data.candidatePeriodOpen),
  });
  return formatElection(election);
};

/**
 * Mise à jour d'une élection existante.
 */
export const updateElection = async (id, data) => {
  const election = await Election.findById(id);
  if (!election) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  Object.assign(election, data);
  await election.save();

  // Si c'est la seule élection ou par défaut, maintenir le Singleton synchrone
  const settings = await ElectionSettings.getSettings();
  if (data.title) settings.title = data.title;
  if (data.description !== undefined) settings.description = data.description;
  if (data.votingStartAt !== undefined) settings.votingStartAt = data.votingStartAt;
  if (data.votingEndAt !== undefined) settings.votingEndAt = data.votingEndAt;
  if (data.votingOpen !== undefined) settings.votingOpen = data.votingOpen;
  if (data.candidateStartAt !== undefined) settings.candidateStartAt = data.candidateStartAt;
  if (data.candidateEndAt !== undefined) settings.candidateEndAt = data.candidateEndAt;
  if (data.candidatePeriodOpen !== undefined) settings.candidatePeriodOpen = data.candidatePeriodOpen;
  if (data.resultsPublished !== undefined) settings.resultsPublished = data.resultsPublished;
  if (data.resultsPublishAt !== undefined) settings.resultsPublishAt = data.resultsPublishAt;
  await settings.save();

  return formatElection(election);
};

