import { z } from 'zod';
import mongoose from 'mongoose';

export const createPositionSchema = z.object({
  name: z
    .string({ required_error: 'Le nom du poste est obligatoire.' })
    .trim()
    .min(2, 'Le nom du poste doit comporter au moins 2 caractères.')
    .max(100, 'Le nom du poste ne peut excéder 100 caractères.'),
  description: z.string().trim().max(500, 'La description ne peut excéder 500 caractères.').optional().default(''),
  order: z.coerce.number().int().min(0, "L'ordre d'affichage doit être un entier positif.").optional().default(0),
  isActive: z.boolean().optional().default(true),
  electionId: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || mongoose.Types.ObjectId.isValid(val), {
      message: 'Identifiant ObjectId de scrutin invalide.',
    }),
});

export const updatePositionSchema = createPositionSchema.partial();
