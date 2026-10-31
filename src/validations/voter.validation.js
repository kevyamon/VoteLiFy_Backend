import { z } from 'zod';

/**
 * Schéma de validation pour l'analyse brute et l'import de numéros de téléphone.
 */
export const importVotersSchema = z.object({
  rawText: z
    .string({ required_error: 'La liste brute des numéros est obligatoire.' })
    .min(5, 'La liste fournie est trop courte pour contenir des numéros valides.')
    .max(50000, 'Le volume de texte dépasse la limite autorisée.'),
});

export const previewVotersSchema = importVotersSchema;
