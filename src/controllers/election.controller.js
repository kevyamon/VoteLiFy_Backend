import {
  getElectionSettings,
  isVotingPeriodActive,
  isCandidacyPeriodActive,
  assertCanPublishResults,
} from '../services/election.service.js';
import { recordAuditLog } from '../services/audit.service.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Récupère les paramètres publics du scrutin et l'état en direct des périodes.
 * Ne divulgue aucune donnée interne ni statistique de dépouillement.
 */
export const getPublicElectionInfo = async (req, res) => {
  const settings = await getElectionSettings();

  const isVotingActive = isVotingPeriodActive(settings);
  const isCandidacyActive = isCandidacyPeriodActive(settings);

  return sendSuccess(
    res,
    {
      title: settings.title,
      description: settings.description,
      timezone: settings.timezone,
      serverTime: new Date().toISOString(),
      candidacies: {
        isOpen: isCandidacyActive,
        startAt: settings.candidateStartAt,
        endAt: settings.candidateEndAt,
      },
      voting: {
        isOpen: isVotingActive,
        startAt: settings.votingStartAt,
        endAt: settings.votingEndAt,
      },
      results: {
        isPublished: settings.resultsPublished,
        publishAt: settings.resultsPublishAt,
      },
    },
    'Informations publiques du scrutin récupérées avec succès.'
  );
};

/**
 * Modification des paramètres généraux du scrutin par la Commission Électorale.
 */
export const updateSettings = async (req, res) => {
  const settings = await getElectionSettings();

  Object.assign(settings, req.body);
  await settings.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    targetType: 'ElectionSettings',
    targetId: String(settings._id),
    metadata: req.body,
    req,
  });

  return sendSuccess(res, settings, 'Paramètres du scrutin mis à jour avec succès.');
};

/**
 * Ouverture officielle de la période de vote.
 * Applique par défaut la durée de référence de 48 heures si aucune date de fin n'est définie.
 */
export const openVoting = async (req, res) => {
  const settings = await getElectionSettings();

  settings.votingOpen = true;
  settings.votingStartAt = new Date();

  // Si aucune échéance n'est préalablement fixée, définir 48 heures par défaut
  if (!settings.votingEndAt || new Date(settings.votingEndAt) <= settings.votingStartAt) {
    settings.votingEndAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  }

  await settings.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.VOTING_OPENED,
    targetType: 'ElectionSettings',
    targetId: String(settings._id),
    metadata: { votingStartAt: settings.votingStartAt, votingEndAt: settings.votingEndAt },
    req,
  });

  return sendSuccess(
    res,
    {
      votingOpen: settings.votingOpen,
      votingStartAt: settings.votingStartAt,
      votingEndAt: settings.votingEndAt,
    },
    'Le scrutin est désormais officiellement ouvert pour une durée de 48 heures.'
  );
};

/**
 * Clôture immédiate de la période de vote.
 */
export const closeVoting = async (req, res) => {
  const settings = await getElectionSettings();

  settings.votingOpen = false;
  settings.votingEndAt = new Date();
  await settings.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.VOTING_CLOSED,
    targetType: 'ElectionSettings',
    targetId: String(settings._id),
    metadata: { closedAt: settings.votingEndAt },
    req,
  });

  return sendSuccess(
    res,
    {
      votingOpen: settings.votingOpen,
      votingEndAt: settings.votingEndAt,
    },
    'Le scrutin a été clôturé avec succès.'
  );
};

/**
 * Ouverture de la période de dépôt des candidatures.
 */
export const openCandidacies = async (req, res) => {
  const settings = await getElectionSettings();

  settings.candidatePeriodOpen = true;
  settings.candidateStartAt = new Date();
  await settings.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACIES_OPENED,
    targetType: 'ElectionSettings',
    targetId: String(settings._id),
    req,
  });

  return sendSuccess(
    res,
    {
      candidatePeriodOpen: settings.candidatePeriodOpen,
      candidateStartAt: settings.candidateStartAt,
    },
    'Le dépôt des candidatures est désormais ouvert.'
  );
};

/**
 * Fermeture de la période de dépôt des candidatures.
 */
export const closeCandidacies = async (req, res) => {
  const settings = await getElectionSettings();

  settings.candidatePeriodOpen = false;
  settings.candidateEndAt = new Date();
  await settings.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.CANDIDACIES_CLOSED,
    targetType: 'ElectionSettings',
    targetId: String(settings._id),
    req,
  });

  return sendSuccess(
    res,
    {
      candidatePeriodOpen: settings.candidatePeriodOpen,
      candidateEndAt: settings.candidateEndAt,
    },
    'Le dépôt des candidatures est désormais clos.'
  );
};

/**
 * Proclamation officielle et publication des résultats certifiés.
 */
export const publishResults = async (req, res) => {
  const settings = await getElectionSettings();

  // Contrôle de cohérence : le scrutin doit impérativement être clos
  assertCanPublishResults(settings);

  settings.resultsPublished = true;
  settings.resultsPublishAt = new Date();
  await settings.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.RESULTS_PUBLISHED,
    targetType: 'ElectionSettings',
    targetId: String(settings._id),
    req,
  });

  return sendSuccess(
    res,
    {
      resultsPublished: settings.resultsPublished,
      resultsPublishAt: settings.resultsPublishAt,
    },
    'Les résultats officiels du scrutin ont été proclamés et publiés avec succès.'
  );
};

/**
 * Rétractation temporaire de la publication des résultats.
 */
export const unpublishResults = async (req, res) => {
  const settings = await getElectionSettings();

  settings.resultsPublished = false;
  await settings.save();

  await recordAuditLog({
    adminId: req.admin._id,
    action: AUDIT_ACTIONS.RESULTS_UNPUBLISHED,
    targetType: 'ElectionSettings',
    targetId: String(settings._id),
    req,
  });

  return sendSuccess(
    res,
    { resultsPublished: settings.resultsPublished },
    'La publication des résultats a été suspendue.'
  );
};

/**
 * Métriques synthétiques du tableau de bord d'administration (CDC Section 5.3).
 */
export const getAdminDashboardStats = async (req, res) => {
  const { Voter, Candidate } = await import('../models/index.js');
  const { PIN_STATUS, CANDIDATE_STATUS } = await import('../config/constants.js');

  const settings = await getElectionSettings();

  const [
    totalVoters,
    votedCount,
    candidatesTotal,
    candidatesPending,
    candidatesApproved,
    candidatesRejected,
  ] = await Promise.all([
    Voter.countDocuments({ pinStatus: PIN_STATUS.ACTIVE }),
    Voter.countDocuments({ pinStatus: PIN_STATUS.ACTIVE, hasVoted: true }),
    Candidate.countDocuments(),
    Candidate.countDocuments({ status: CANDIDATE_STATUS.PENDING }),
    Candidate.countDocuments({ status: CANDIDATE_STATUS.APPROVED }),
    Candidate.countDocuments({ status: CANDIDATE_STATUS.REJECTED }),
  ]);

  const remainingVoters = Math.max(0, totalVoters - votedCount);
  const participationRate = totalVoters > 0 ? Number(((votedCount / totalVoters) * 100).toFixed(2)) : 0;

  return sendSuccess(
    res,
    {
      participation: {
        totalVoters,
        votedCount,
        remainingVoters,
        participationRate,
      },
      candidates: {
        total: candidatesTotal,
        pending: candidatesPending,
        approved: candidatesApproved,
        rejected: candidatesRejected,
      },
      periods: {
        votingOpen: isVotingPeriodActive(settings),
        candidatePeriodOpen: isCandidacyPeriodActive(settings),
        resultsPublished: settings.resultsPublished,
      },
      serverTime: new Date().toISOString(),
    },
    'Statistiques du tableau de bord récupérées avec succès.'
  );
};
