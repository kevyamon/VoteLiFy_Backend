import { submitBallot, calculateTally, resetTestData } from '../services/vote.service.js';
import { emitSocketEvent } from '../services/socket.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Enregistrement public d'un vote par code PIN individuel.
 */
export const submitVoteController = async (req, res) => {
  const { candidateId, pin } = req.body;

  const result = await submitBallot({
    candidateId,
    rawPin: pin,
  });

  emitSocketEvent('VOTE_CAST', {
    candidateId,
    hasVoted: true,
  });

  return sendSuccess(res, result, result.message);
};

/**
 * Consultation du dépouillement en direct et des statistiques de participation par l'administrateur.
 */
export const getTallyAdminController = async (req, res) => {
  const tally = await calculateTally(req.query.electionId || null);

  return sendSuccess(res, tally, 'Dépouillement confidentiel calculé avec succès.');
};

/**
 * Réinitialisation sécurisée des votes de test (Zone dangereuse).
 */
export const resetTestDataAdminController = async (req, res) => {
  const { password, electionId } = req.body;

  const result = await resetTestData({
    adminPassword: password,
    admin: req.admin,
    req,
    electionId: electionId || req.query.electionId || null,
  });

  emitSocketEvent('ELECTION_RESET', { electionId: electionId || req.query.electionId || null });
  emitSocketEvent('ELECTION_UPDATED', {});

  return sendSuccess(res, result, result.message);
};

