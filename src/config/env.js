import dotenv from 'dotenv';
import { z } from 'zod';

// Chargement des variables d'environnement
dotenv.config();

/**
 * Schéma déclaratif de validation des variables d'environnement.
 * Empêche le démarrage du serveur en présence d'une configuration invalide ou incomplète.
 */
const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGO_URI: z.string().min(1, 'La variable MONGO_URI est obligatoire.'),
  JWT_SECRET: z.string().min(32, 'La variable JWT_SECRET doit contenir au moins 32 caractères.'),
  AD_PW: z.string().min(8, "La variable AD_PW d'initialisation administrateur doit comporter au moins 8 caractères."),
  CLIENT_URL: z.string().url('La variable CLIENT_URL doit être une URL valide.').default('http://localhost:5173'),
  ADMIN_SESSION_HOURS: z.coerce.number().default(12),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Échec critique lors de l'initialisation des variables d'environnement :");
    console.error(parsed.error.format());
    process.exit(1);
  }

  return parsed.data;
};

export const env = parseEnv();
