import { z } from 'zod';
import mongoose from 'mongoose';
import { SECURITY_CONFIG } from '../config/constants.js';

const objectIdValidator = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Identifiant ObjectId de candidat invalide.',
});

export const submitVoteSchema = z.object({
  candidateId: objectIdValidator,
  pin: z
    .string({ required_error: 'Le code PIN individuel est obligatoire.' })
    .trim()
    .transform((val) => val.toUpperCase().replace(/\s+/g, ''))
    .refine((val) => SECURITY_CONFIG.PIN_REGEX.test(val), {
      message: 'Format de code PIN invalide. Le format attendu est du type VT-00000-A ou VT-0000-A.',
    }),
});
