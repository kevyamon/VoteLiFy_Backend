import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Schéma de validation pour l'analyse brute et l'import de numéros de téléphone.
 */
export const importVotersSchema = z.object({
  rawText: z
    .string({ required_error: 'La liste brute des numéros est obligatoire.' })
    .min(5, 'La liste fournie est trop courte pour contenir des numéros valides.')
    .max(50000, 'Le volume de texte dépasse la limite autorisée.'),
  electionId: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || mongoose.Types.ObjectId.isValid(val), {
      message: 'Identifiant ObjectId de scrutin invalide.',
    }),
});

export const previewVotersSchema = importVotersSchema;
