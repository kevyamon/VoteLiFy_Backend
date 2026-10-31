import mongoose from 'mongoose';
import { Voter, Vote, Candidate, ElectionSettings, Admin } from '../models/index.js';
import { isVotingPeriodActive } from './election.service.js';
import { verifyPin } from './pin.service.js';
import { recordAuditLog } from './audit.service.js';
import { CANDIDATE_STATUS, PIN_STATUS, AUDIT_ACTIONS, HTTP_STATUS } from '../config/constants.js';
import { AppError } from '../middlewares/error.middleware.js';

/**
 * Enregistre un suffrage électoral de manière atomique et strictement anonyme.
 * 
 * GARANTIES D'INTÉGRITÉ & PROTECTION CONTRE LES RACE CONDITIONS :
 * 1. Le vote n'est accepté que si la période de scrutin est formellement ouverte.
 * 2. Le candidat sélectionné doit être actif et posséder le statut APPROVED.
 * 3. Le code PIN est vérifié contre le registre d'émargement des électeurs actifs n'ayant pas encore voté.
 * 4. La consommation du droit de vote s'opère par une écriture conditionnelle atomique ({ _id, hasVoted: false }).
 * 5. Le suffrage est consigné dans une urne numérique isolée sans aucun lien avec l'électeur.
 * 
 * @param {Object} params
 * @param {string} params.candidateId
 * @param {string} params.rawPin
 * @returns {Promise<Object>}
 */
export const submitBallot = async ({ candidateId, rawPin }) => {
  // 1. Contrôle d'ouverture de la période de vote
  const settings = await ElectionSettings.getSettings();
  if (!isVotingPeriodActive(settings)) {
    throw new AppError(
      'La période de vote est fermée. Il n’est plus possible d’enregistrer de suffrage.',
      HTTP_STATUS.BAD_REQUEST,
      'VOTING_CLOSED'
    );
  }

  // 2. Vérification de l'éligibilité du candidat
  const candidate = await Candidate.findOne({
    _id: candidateId,
    status: CANDIDATE_STATUS.APPROVED,
  }).lean();

  if (!candidate) {
    throw new AppError(
      'Ce candidat n’est plus disponible pour ce scrutin.',
      HTTP_STATUS.BAD_REQUEST,
      'CANDIDATE_NOT_AVAILABLE'
    );
  }

  // 3. Normalisation du PIN
  const normalizedPin = String(rawPin).trim().toUpperCase().replace(/\s+/g, '');

  // 4. Recherche de l'électeur correspondant parmi les électeurs autorisés non encore émargés
  const potentialVoters = await Voter.find({
    pinStatus: PIN_STATUS.ACTIVE,
  }).select('+pinHash');

  let matchedVoter = null;

  for (const voter of potentialVoters) {
    const isMatch = await verifyPin(normalizedPin, voter.pinHash);
    if (isMatch) {
      matchedVoter = voter;
      break;
    }
  }

  // Si aucun électeur n'est trouvé avec ce PIN
  if (!matchedVoter) {
    throw new AppError(
      'Le code PIN saisi est incorrect. Vérifiez votre code personnel et réessayez.',
      HTTP_STATUS.UNAUTHORIZED,
      'INVALID_PIN'
    );
  }

  // Si l'électeur a déjà voté
  if (matchedVoter.hasVoted) {
    throw new AppError(
      'Ce code PIN a déjà été utilisé pour voter. Chaque électeur ne dispose que d’un seul vote.',
      HTTP_STATUS.CONFLICT,
      'PIN_ALREADY_USED'
    );
  }

  // 5. Exécution atomique : émargement conditionnel + enregistrement du suffrage
  // Prise en charge résiliente des transactions MongoDB (avec fallback atomique si standalone)
  let session = null;
  let useTransaction = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
  } catch {
    // Si l'instance MongoDB locale n'est pas configurée en Replica Set, on utilise l'atomicité native de findOneAndUpdate
    session = null;
    useTransaction = false;
  }

  try {
    // Émargement atomique irréversible : échoue immédiatement si une requête concurrente a déjà modifié hasVoted
    const atomicOptions = session ? { session, new: true } : { new: true };
    const updatedVoter = await Voter.findOneAndUpdate(
      { _id: matchedVoter._id, hasVoted: false },
      { $set: { hasVoted: true, votedAt: new Date() } },
      atomicOptions
    );

    if (!updatedVoter) {
      throw new AppError(
        'Ce code PIN a déjà été consommé lors d’une opération simultanée.',
        HTTP_STATUS.CONFLICT,
        'RACE_CONDITION_BLOCKED'
      );
    }

    // Enregistrement du suffrage scellé dans l'urne anonyme
    if (useTransaction && session) {
      await Vote.create(
        [
          {
            positionId: candidate.positionId,
            candidateId: candidate._id,
          },
        ],
        { session }
      );
      await session.commitTransaction();
    } else {
      await Vote.create({
        positionId: candidate.positionId,
        candidateId: candidate._id,
      });
    }

    return {
      success: true,
      candidateName: candidate.fullName,
      message: 'Votre vote a été enregistré avec succès. Merci pour votre participation !',
    };
  } catch (error) {
    if (useTransaction && session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * Calcul du dépouillement en direct et des statistiques de participation.
 * Réservé exclusivement à la Commission Électorale.
 * 
 * @returns {Promise<Object>}
 */
export const calculateTally = async () => {
  // 1. Métriques de participation globale
  const totalVoters = await Voter.countDocuments({ pinStatus: PIN_STATUS.ACTIVE });
  const votedCount = await Voter.countDocuments({
    pinStatus: PIN_STATUS.ACTIVE,
    hasVoted: true,
  });
  const remainingCount = Math.max(0, totalVoters - votedCount);
  const participationRate = totalVoters > 0 ? Number(((votedCount / totalVoters) * 100).toFixed(2)) : 0;

  // 2. Récupération des postes et candidats approuvés
  const candidates = await Candidate.find({ status: CANDIDATE_STATUS.APPROVED })
    .populate('positionId', 'name order')
    .select('fullName positionId photoUrl')
    .lean();

  // 3. Agrégation des suffrages exprimés par candidat
  const voteAggregations = await Vote.aggregate([
    {
      $group: {
        _id: '$candidateId',
        voteCount: { $sum: 1 },
      },
    },
  ]);

  const voteCountMap = new Map();
  voteAggregations.forEach((item) => {
    voteCountMap.set(String(item._id), item.voteCount);
  });

  // 4. Regroupement par poste avec calcul des pourcentages
  const positionsMap = new Map();

  for (const candidate of candidates) {
    const pos = candidate.positionId;
    if (!pos) continue;

    const posId = String(pos._id);
    if (!positionsMap.has(posId)) {
      positionsMap.set(posId, {
        positionId: pos._id,
        positionName: pos.name,
        positionOrder: pos.order || 0,
        totalVotesInPosition: 0,
        candidates: [],
      });
    }

    const votes = voteCountMap.get(String(candidate._id)) || 0;
    const group = positionsMap.get(posId);
    group.totalVotesInPosition += votes;

    group.candidates.push({
      candidateId: candidate._id,
      fullName: candidate.fullName,
      photoUrl: candidate.photoUrl,
      votes,
      percentage: 0, // Calculé ci-dessous
    });
  }

  // Calcul final des pourcentages et tri décroissant des voix par poste
  const tallyByPosition = Array.from(positionsMap.values())
    .map((group) => {
      const formattedCandidates = group.candidates
        .map((cand) => {
          const percentage = group.totalVotesInPosition > 0
            ? Number(((cand.votes / group.totalVotesInPosition) * 100).toFixed(2))
            : 0;
          return { ...cand, percentage };
        })
        .sort((a, b) => b.votes - a.votes);

      return {
        ...group,
        candidates: formattedCandidates,
      };
    })
    .sort((a, b) => a.positionOrder - b.positionOrder);

  return {
    participation: {
      totalVoters,
      votedCount,
      remainingCount,
      participationRate,
    },
    tallyByPosition,
  };
};

/**
 * Réinitialisation sécurisée des données de test avant le lancement officiel.
 * 
 * @param {Object} params
 * @param {string} params.adminPassword - Mot de passe de l'administrateur pour double validation
 * @param {import('../models/Admin.model.js').Admin} params.admin - Administrateur connecté
 * @param {import('express').Request} params.req
 */
export const resetTestData = async ({ adminPassword, admin, req }) => {
  // Re-vérification obligatoire du mot de passe administrateur
  const isMatch = await admin.comparePassword(adminPassword);
  if (!isMatch) {
    throw new AppError(
      'Mot de passe administrateur incorrect. La réinitialisation a été refusée.',
      HTTP_STATUS.UNAUTHORIZED,
      'INVALID_ADMIN_PASSWORD'
    );
  }

  // 1. Réinitialisation des votes
  await Vote.deleteMany({});

  // 2. Réinitialisation des statuts d'émargement des électeurs
  await Voter.updateMany({}, { $set: { hasVoted: false, votedAt: null } });

  // 3. Masquage des résultats dans les paramètres
  const settings = await ElectionSettings.getSettings();
  settings.resultsPublished = false;
  await settings.save();

  // 4. Enregistrement obligatoire dans le journal d'audit
  await recordAuditLog({
    adminId: admin._id,
    action: AUDIT_ACTIONS.TEST_DATA_RESET,
    targetType: 'Election',
    metadata: { confirmedBy: admin.username },
    req,
  });

  return {
    success: true,
    message: 'Les données de test ont été réinitialisées avec succès. Les compteurs de votes sont remis à zéro.',
  };
};
