import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { SECURITY_CONFIG } from '../config/constants.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Génère un code PIN cryptographiquement sécurisé au format VT-XXXXX-A.
 * 
 * - Préfixe immuable : 'VT'
 * - 5 chiffres aléatoires imprévisibles (10000 à 99999)
 * - 1 lettre aléatoire (A à Z)
 * 
 * @returns {string} Code PIN généré (ex: 'VT-48291-K')
 */
export const generateSinglePin = () => {
  const randomDigits = crypto.randomInt(10000, 100000);
  const letterIndex = crypto.randomInt(0, ALPHABET.length);
  const randomLetter = ALPHABET[letterIndex];

  return `${SECURITY_CONFIG.PIN_PREFIX}-${randomDigits}-${randomLetter}`;
};

/**
 * Hache un code PIN avec Bcrypt à 12 rounds.
 * 
 * @param {string} rawPin
 * @returns {Promise<string>}
 */
export const hashPin = async (rawPin) => {
  const normalizedPin = String(rawPin).trim().toUpperCase();
  return bcrypt.hash(normalizedPin, SECURITY_CONFIG.BCRYPT_SALT_ROUNDS);
};

/**
 * Vérifie un code PIN fourni par l'électeur contre l'empreinte stockée.
 * 
 * @param {string} rawPin
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export const verifyPin = async (rawPin, storedHash) => {
  const normalizedPin = String(rawPin).trim().toUpperCase();
  return bcrypt.compare(normalizedPin, storedHash);
};

/**
 * Formate le message individuel WhatsApp prêt à être transmis à l'électeur.
 * Conforme au modèle défini dans le cahier des charges officiel.
 * 
 * @param {Object} params
 * @param {string} params.pin - Code PIN en clair (uniquement lors de la génération initiale)
 * @param {string} [params.clientUrl] - URL publique de VoteLiFy
 * @param {string} [params.electionTitle] - Titre officiel du scrutin
 * @returns {string}
 */
export const formatWhatsAppMessage = ({
  pin,
  clientUrl = 'https://votelify.com',
  electionTitle = 'FORMATION NO-CODE',
}) => {
  return `Bonjour ! 👋

Dans le cadre de l'élection de la ${electionTitle}, voici ton accès personnel pour participer au vote sur VoteLiFy.

🔗 Lien : ${clientUrl}

🔑 Ton code PIN personnel : ${pin}

Ce code est strictement confidentiel et ne peut être utilisé qu'une seule fois.

Le scrutin est ouvert pendant la période officielle annoncée.

Merci de conserver ce code et de ne pas le partager.`;
};
