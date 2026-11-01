import { ElectionSettings, Election, Vote } from '../models/index.js';
import { uploadElectionImage } from './cloudinary.service.js';
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
    imageUrl: election.imageUrl || '',
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
 * Création d'une nouvelle élection par l'administrateur avec protection anti-doublon.
 */
export const createNewElection = async (data, adminId) => {
  const cleanTitle = (data.title || '').trim();

  // Protection anti-doublon stricte : empêche la création en double si cliqué deux fois
  const recentDuplicate = await Election.findOne({
    title: cleanTitle,
    isActive: true,
    createdAt: { $gte: new Date(Date.now() - 15 * 1000) },
  });

  if (recentDuplicate) {
    return formatElection(recentDuplicate);
  }

  let processedImageUrl = (data.imageUrl || '').trim();
  if (processedImageUrl && (processedImageUrl.startsWith('data:image/') || !processedImageUrl.includes('cloudinary.com'))) {
    processedImageUrl = await uploadElectionImage(processedImageUrl, cleanTitle);
  }

  const election = await Election.create({
    ...data,
    title: cleanTitle,
    imageUrl: processedImageUrl,
    createdBy: adminId,
    votingOpen: Boolean(data.votingOpen),
    candidatePeriodOpen: Boolean(data.candidatePeriodOpen),
  });

  return formatElection(election);
};

/**
 * Mise à jour d'une élection existante (titre, dates, description, image).
 */
export const updateElection = async (id, data) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  if (data.imageUrl && (data.imageUrl.startsWith('data:image/') || !data.imageUrl.includes('cloudinary.com'))) {
    data.imageUrl = await uploadElectionImage(data.imageUrl, data.title || election.title);
  }

  Object.assign(election, data);
  await election.save();

  return formatElection(election);
};

/**
 * Ouverture officielle de la période de vote pour un scrutin spécifique.
 */
export const openElectionVoting = async (id) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  election.votingOpen = true;
  election.votingStartAt = new Date();
  if (!election.votingEndAt || new Date(election.votingEndAt) <= election.votingStartAt) {
    election.votingEndAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  }
  await election.save();
  return formatElection(election);
};

/**
 * Clôture officielle de la période de vote pour un scrutin spécifique.
 */
export const closeElectionVoting = async (id) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  election.votingOpen = false;
  election.votingEndAt = new Date();
  await election.save();
  return formatElection(election);
};

/**
 * Ouverture du dépôt des candidatures pour un scrutin spécifique.
 */
export const openElectionCandidacies = async (id) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  election.candidatePeriodOpen = true;
  election.candidateStartAt = new Date();
  await election.save();
  return formatElection(election);
};

/**
 * Fermeture du dépôt des candidatures pour un scrutin spécifique.
 */
export const closeElectionCandidacies = async (id) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  election.candidatePeriodOpen = false;
  election.candidateEndAt = new Date();
  await election.save();
  return formatElection(election);
};

/**
 * Publication officielle des résultats pour un scrutin spécifique.
 */
export const publishElectionResults = async (id) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  assertCanPublishResults(election);

  election.resultsPublished = true;
  election.resultsPublishAt = new Date();
  await election.save();
  return formatElection(election);
};

/**
 * Suspension de la publication des résultats pour un scrutin spécifique.
 */
export const unpublishElectionResults = async (id) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  election.resultsPublished = false;
  await election.save();
  return formatElection(election);
};

/**
 * Suppression sécurisée d'une élection.
 * RÈGLE MÉTIER STRICTE : Impossible de supprimer une élection en cours lorsque des votes ont déjà été enregistrés.
 */
export const deleteElection = async (id) => {
  const election = await Election.findById(id);
  if (!election || !election.isActive) {
    throw new AppError('Élection introuvable.', HTTP_STATUS.NOT_FOUND, 'ELECTION_NOT_FOUND');
  }

  const votesCount = await Vote.countDocuments({ electionId: election._id });
  const isVotingActive = isVotingPeriodActive(election);

  if (votesCount > 0 && isVotingActive) {
    throw new AppError(
      'Impossible de supprimer une élection en cours lorsque des suffrages ont déjà été enregistrés. Clôturez d’abord le scrutin ou réinitialisez les votes.',
      HTTP_STATUS.BAD_REQUEST,
      'CANNOT_DELETE_ACTIVE_ELECTION_WITH_VOTES'
    );
  }

  election.isActive = false;
  await election.save();

  return { id: election._id, title: election.title, deleted: true };
};

