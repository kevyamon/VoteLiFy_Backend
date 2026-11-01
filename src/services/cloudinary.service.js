import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

/**
 * Service d'intégration Cloudinary pour le téléversement et le traitement
 * optimisé des photos officielles des candidats électoraux.
 */

const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Téléverse et recadre automatiquement la photo d'un candidat sur son visage
 * avec optimisation de débit et conversion automatique au meilleur format web (WebP/AVIF).
 *
 * @param {string} imageBase64OrUrl - Image encodée en Data URI base64 ou URL publique
 * @param {string} candidateName - Nom du candidat pour l'indexation
 * @returns {Promise<string>} - URL sécurisée (HTTPS) de l'image optimisée
 */
export const uploadCandidatePhoto = async (imageBase64OrUrl, candidateName = '') => {
  if (!isCloudinaryConfigured) {
    console.warn("⚠️ Cloudinary n'est pas configuré. Utilisation de la source brute.");
    return imageBase64OrUrl;
  }

  // Si l'image est déjà une URL Cloudinary hébergée, la retourner directement
  if (typeof imageBase64OrUrl === 'string' && imageBase64OrUrl.includes('cloudinary.com')) {
    return imageBase64OrUrl;
  }

  try {
    const safeTag = candidateName
      ? candidateName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      : 'candidat';

    const uploadResult = await cloudinary.uploader.upload(imageBase64OrUrl, {
      folder: 'votelify/candidates',
      public_id: `vlf_${Date.now()}_${safeTag}`,
      overwrite: false,
      resource_type: 'image',
      // Recadrage centré sur le visage pour un rendu parfait dans les cartes
      transformation: [
        { width: 600, height: 600, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    return uploadResult.secure_url;
  } catch (error) {
    console.error('❌ Échec du téléversement de la photo sur Cloudinary :', error);
    throw new Error('Échec du traitement de la photo officielle sur le serveur média.');
  }
};

/**
 * Téléverse et optimise l'image d'illustration officielle d'un scrutin électoral.
 *
 * @param {string} imageBase64OrUrl - Image encodée en Data URI base64 ou URL publique
 * @param {string} electionTitle - Titre du scrutin pour le nommage
 * @returns {Promise<string>} - URL sécurisée (HTTPS) de l'image optimisée
 */
export const uploadElectionImage = async (imageBase64OrUrl, electionTitle = '') => {
  if (!isCloudinaryConfigured) {
    console.warn("⚠️ Cloudinary n'est pas configuré. Utilisation de l'image brute.");
    return imageBase64OrUrl;
  }

  if (typeof imageBase64OrUrl === 'string' && imageBase64OrUrl.includes('cloudinary.com')) {
    return imageBase64OrUrl;
  }

  try {
    const safeTag = electionTitle
      ? electionTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30)
      : 'election';

    const uploadResult = await cloudinary.uploader.upload(imageBase64OrUrl, {
      folder: 'votelify/elections',
      public_id: `vlf_election_${Date.now()}_${safeTag}`,
      overwrite: false,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    return uploadResult.secure_url;
  } catch (error) {
    console.error("❌ Échec du téléversement de l'illustration de l'élection sur Cloudinary :", error);
    throw new Error("Échec du traitement de l'image d'illustration sur le serveur média.");
  }
};

