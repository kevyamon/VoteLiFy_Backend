import { ElectionSettings, Voter, Vote, Candidate, Position } from '../models/index.js';
import { CANDIDATE_STATUS, PIN_STATUS } from '../config/constants.js';

/**
 * Calcule et certifie les résultats officiels proclamés pour la page publique.
 * 
 * GARANTIES D'INTÉGRITÉ :
 * 1. Détection formelle des égalités (ex-æquo) sans décision arbitraire.
 * 2. Présence obligatoire de tous les candidats approuvés, y compris ceux ayant 0 voix.
 * 3. Exactitude des pourcentages officiels calculés au centième près.
 * 
 * @returns {Promise<Object>}
 */
export const getCertifiedPublicResults = async () => {
  // 1. Statistiques globales officielles de participation
  const totalVoters = await Voter.countDocuments({ pinStatus: PIN_STATUS.ACTIVE });
  const totalVotesCast = await Vote.countDocuments();
  const participationRate = totalVoters > 0
    ? Number(((totalVotesCast / totalVoters) * 100).toFixed(2))
    : 0;

  // 2. Récupération ordonnée des postes actifs
  const positions = await Position.find({ isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();

  const positionIds = positions.map((p) => p._id);

  // 3. Récupération des candidats approuvés
  const candidates = await Candidate.find({
    status: CANDIDATE_STATUS.APPROVED,
    positionId: { $in: positionIds },
  })
    .select('fullName positionId photoUrl')
    .lean();

  // 4. Agrégation des suffrages réels
  const voteAggregations = await Vote.aggregate([
    {
      $group: {
        _id: '$candidateId',
        votesCount: { $sum: 1 },
      },
    },
  ]);

  const votesMap = new Map();
  voteAggregations.forEach((item) => {
    votesMap.set(String(item._id), item.votesCount);
  });

  // 5. Construction des résultats par poste électoral
  const resultsByPosition = positions.map((pos) => {
    const posCandidates = candidates.filter(
      (c) => String(c.positionId) === String(pos._id)
    );

    let totalVotesInPosition = 0;

    const formattedCandidates = posCandidates.map((cand) => {
      const votes = votesMap.get(String(cand._id)) || 0;
      totalVotesInPosition += votes;

      return {
        candidateId: cand._id,
        fullName: cand.fullName,
        photoUrl: cand.photoUrl,
        votes,
        percentage: 0, // Calculé ci-dessous
      };
    });

    // Calcul des pourcentages et tri décroissant
    const rankedCandidates = formattedCandidates
      .map((cand) => ({
        ...cand,
        percentage: totalVotesInPosition > 0
          ? Number(((cand.votes / totalVotesInPosition) * 100).toFixed(2))
          : 0,
      }))
      .sort((a, b) => b.votes - a.votes);

    // Détection des vainqueurs et égalités (CDC Section 10.5 & Cas 14)
    const maxVotes = rankedCandidates.length > 0 ? rankedCandidates[0].votes : 0;
    const topCandidates = rankedCandidates.filter((c) => c.votes === maxVotes && maxVotes > 0);
    const isTie = topCandidates.length > 1;

    return {
      positionId: pos._id,
      positionName: pos.name,
      positionDescription: pos.description,
      order: pos.order,
      totalVotes: totalVotesInPosition,
      isTie,
      hasWinner: topCandidates.length === 1,
      winnerCandidateId: topCandidates.length === 1 ? topCandidates[0].candidateId : null,
      candidates: rankedCandidates,
    };
  });

  return {
    participation: {
      totalVoters,
      totalVotesCast,
      participationRate,
    },
    resultsByPosition,
  };
};
