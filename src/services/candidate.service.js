import { Candidate, Position } from '../models/index.js';
import { CANDIDATE_STATUS } from '../config/constants.js';

/**
 * Valide si une URL vidéo provient d'une plateforme reconnue (YouTube, Google Drive, Vimeo).
 * 
 * @param {string} url
 * @returns {boolean}
 */
export const isValidVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return true; // Facultatif
  const trimmed = url.trim();
  if (trimmed === '') return true;

  const validDomains = [
    'youtube.com',
    'youtu.be',
    'drive.google.com',
    'vimeo.com',
  ];

  try {
    const parsed = new URL(trimmed);
    return validDomains.some((domain) => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
};

/**
 * Récupère tous les candidats officiellement approuvés, regroupés et ordonnés par poste.
 * 
 * @returns {Promise<Array>}
 */
export const getApprovedCandidatesGroupedByPosition = async () => {
  // 1. Récupération des postes actifs
  const positions = await Position.find({ isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();

  const positionIds = positions.map((p) => p._id);

  // 2. Récupération des candidats approuvés rattachés à ces postes
  const candidates = await Candidate.find({
    status: CANDIDATE_STATUS.APPROVED,
    positionId: { $in: positionIds },
  })
    .select('fullName positionId photoUrl pitch videoUrl createdAt')
    .sort({ fullName: 1 })
    .lean();

  // 3. Regroupement par poste
  return positions.map((pos) => ({
    ...pos,
    candidates: candidates.filter(
      (c) => String(c.positionId) === String(pos._id)
    ),
  }));
};
