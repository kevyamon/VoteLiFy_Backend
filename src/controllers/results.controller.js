import { ElectionSettings } from '../models/index.js';
import { isVotingPeriodActive } from '../services/election.service.js';
import { getCertifiedPublicResults } from '../services/results.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Consultation publique des résultats certifiés du scrutin.
 * Étanchéité stricte : si les résultats ne sont pas encore proclamés, renvoie l'état d'attente solennel.
 */
export const getPublicResults = async (req, res) => {
  const electionId = req.query.electionId || null;
  let targetElection = null;
  if (electionId) {
    const { Election } = await import('../models/index.js');
    targetElection = await Election.findById(electionId);
  }
  if (!targetElection) {
    targetElection = await ElectionSettings.getSettings();
  }

  // État A — Résultats non encore proclamés par la Commission Électorale
  if (!targetElection.resultsPublished) {
    return sendSuccess(
      res,
      {
        isPublished: false,
        votingClosed: !isVotingPeriodActive(targetElection),
        publishAt: targetElection.resultsPublishAt,
        title: targetElection.title,
        message:
          'Scrutin en cours d’évaluation. Les résultats certifiés seront proclamés par la Commission Électorale à l’issue de la période officielle.',
      },
      'Scrutin en attente de proclamation officielle.'
    );
  }

  // État B — Résultats proclamés et certifiés
  const certifiedData = await getCertifiedPublicResults(targetElection._id);

  return sendSuccess(
    res,
    {
      isPublished: true,
      publishedAt: targetElection.resultsPublishAt || new Date().toISOString(),
      electionTitle: targetElection.title,
      banner: 'Résultats définitifs et certifiés',
      ...certifiedData,
    },
    'Résultats certifiés de l’élection proclamés avec succès.'
  );
};
