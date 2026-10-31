import { Voter } from '../models/index.js';
import { generateSinglePin, hashPin, formatWhatsAppMessage } from './pin.service.js';

/**
 * Normalise un numéro de téléphone brut au standard international E.164 (+...).
 * Traite les numéros ivoiriens à 10 chiffres (ajoute +225 si omis), supprime les espaces et tirets.
 * 
 * @param {string} raw
 * @returns {string|null} Numéro E.164 normalisé ou null si non valide
 */
export const normalizePhoneNumber = (raw) => {
  if (!raw || typeof raw !== 'string') return null;

  // 1. Suppression des caractères parasites (espaces, tirets, points, parenthèses)
  let cleaned = raw.trim().replace(/[\s\-\.\(\)]/g, '');

  // 2. Conversion du préfixe 00 en +
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  // 3. Traitement local Côte d'Ivoire (10 chiffres commençant par 01, 05, 07 ou autre sans indicatif)
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    cleaned = `+225${cleaned}`;
  }

  // 4. Validation finale du format E.164 (+ suivi de 8 à 15 chiffres)
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  if (!e164Regex.test(cleaned)) {
    return null;
  }

  return cleaned;
};

/**
 * Découpe un texte brut multiligne ou séparé par virgules en segments individuels.
 * 
 * @param {string} rawText
 * @returns {Array<{ raw: string, normalized: string|null, isValid: boolean }>}
 */
export const parseRawPhoneInput = (rawText) => {
  const tokens = rawText
    .split(/[\r\n,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  return tokens.map((token) => {
    const normalized = normalizePhoneNumber(token);
    return {
      raw: token,
      normalized,
      isValid: Boolean(normalized),
    };
  });
};

/**
 * Analyse une liste brute d'électeurs sans modifier la base de données (Prévisualisation).
 * 
 * @param {string} rawText
 * @returns {Promise<Object>} Rapport statistique de validation
 */
export const previewVoters = async (rawText) => {
  const parsedItems = parseRawPhoneInput(rawText);

  const seenInBatch = new Set();
  const validBatchNumbers = [];
  const duplicatesInBatch = [];
  const invalidTokens = [];

  for (const item of parsedItems) {
    if (!item.isValid) {
      invalidTokens.push(item.raw);
      continue;
    }

    if (seenInBatch.has(item.normalized)) {
      duplicatesInBatch.push(item.normalized);
    } else {
      seenInBatch.add(item.normalized);
      validBatchNumbers.push(item.normalized);
    }
  }

  // Recherche des numéros déjà enregistrés en base de données
  const existingVoters = await Voter.find({
    phone: { $in: validBatchNumbers },
  }).select('phone hasVoted').lean();

  const existingPhoneSet = new Set(existingVoters.map((v) => v.phone));
  const newNumbersToImport = validBatchNumbers.filter((phone) => !existingPhoneSet.has(phone));

  return {
    totalDetected: parsedItems.length,
    validCount: validBatchNumbers.length,
    duplicateInBatchCount: duplicatesInBatch.length,
    invalidCount: invalidTokens.length,
    alreadyInDatabaseCount: existingPhoneSet.size,
    newToImportCount: newNumbersToImport.length,
    newNumbersToImport,
    invalidTokens,
    alreadyInDatabase: Array.from(existingPhoneSet),
  };
};

/**
 * Importe définitivement les nouveaux électeurs et génère leurs codes PIN uniques.
 * 
 * @param {Object} params
 * @param {string} params.rawText
 * @param {string} params.clientUrl
 * @param {string} params.electionTitle
 * @returns {Promise<Object>}
 */
export const importVotersAndGeneratePins = async ({
  rawText,
  clientUrl,
  electionTitle,
}) => {
  const preview = await previewVoters(rawText);

  if (preview.newToImportCount === 0) {
    return {
      importedCount: 0,
      votersWithPin: [],
      message: 'Aucun nouvel électeur valide à importer.',
    };
  }

  const generatedPins = new Set();
  const votersToInsert = [];
  const generatedDistributionList = [];

  for (const phone of preview.newNumbersToImport) {
    // Génération d'un PIN garanti unique au sein du lot
    let pin = generateSinglePin();
    while (generatedPins.has(pin)) {
      pin = generateSinglePin();
    }
    generatedPins.add(pin);

    // Hachage du code PIN pour le stockage sécurisé dans MongoDB
    const pinHash = await hashPin(pin);

    votersToInsert.push({
      phone,
      pinHash,
      hasVoted: false,
    });

    // Préparation de la restitution en clair pour distribution immédiate
    const message = formatWhatsAppMessage({
      pin,
      clientUrl,
      electionTitle,
    });

    generatedDistributionList.push({
      phone,
      pin, // Valeur en clair restituée EXCLUSIVEMENT à cette étape
      message,
    });
  }

  // Insertion en masse dans MongoDB
  await Voter.insertMany(votersToInsert);

  return {
    importedCount: votersToInsert.length,
    votersWithPin: generatedDistributionList,
    summary: {
      totalSubmitted: preview.totalDetected,
      alreadyExisting: preview.alreadyInDatabaseCount,
      invalidCount: preview.invalidCount,
    },
  };
};
