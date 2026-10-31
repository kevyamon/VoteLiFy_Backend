import { ElectionSettings } from '../models/index.js';
import { isVotingPeriodActive } from '../services/election.service.js';
import { getCertifiedPublicResults } from '../services/results.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Consultation publique des résultats certifiés du scrutin.
 * Étanchéité stricte : si les résultats ne sont pas encore proclamés, renvoie l'état d'attente solennel.
 */
export const getPublicResults = async (req, res) => {
  const settings = await ElectionSettings.getSettings();

  // État A — Résultats non encore proclamés par la Commission Électorale
  if (!settings.resultsPublished) {
    return sendSuccess(
      res,
      {
        isPublished: false,
        votingClosed: !isVotingPeriodActive(settings),
        publishAt: settings.resultsPublishAt,
        title: settings.title,
        message:
          'Scrutin en cours d’évaluation. Les résultats certifiés seront proclamés par la Commission Électorale à l’issue de la période officielle.',
      },
      'Scrutin en attente de proclamation officielle.'
    );
  }

  // État B — Résultats proclamés et certifiés
  const certifiedData = await getCertifiedPublicResults();

  return sendSuccess(
    res,
    {
      isPublished: true,
      publishedAt: settings.resultsPublishAt || new Date().toISOString(),
      electionTitle: settings.title,
      banner: 'Résultats définitifs et certifiés',
      ...certifiedData,
    },
    'Résultats certifiés de l’élection proclamés avec succès.'
  );
};
