import { z } from 'zod';
import mongoose from 'mongoose';
import { CANDIDATE_STATUS } from '../config/constants.js';

const objectIdValidator = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Identifiant ObjectId invalide.',
});

export const createCandidateSchema = z.object({
  fullName: z
    .string({ required_error: 'Le nom et prénom du candidat sont obligatoires.' })
    .trim()
    .min(2, 'Le nom complet doit comporter au moins 2 caractères.')
    .max(120, 'Le nom complet ne peut excéder 120 caractères.'),
  phone: z
    .string({ required_error: 'Le numéro WhatsApp est obligatoire.' })
    .trim()
    .min(8, 'Le numéro de téléphone est trop court.')
    .max(20, 'Le numéro de téléphone est trop long.'),
  positionId: objectIdValidator,
  photoUrl: z
    .string({ required_error: 'La photo officielle est obligatoire.' })
    .trim()
    .min(5, "L'URL de la photo est invalide."),
  pitch: z
    .string({ required_error: 'Le programme / pitch est obligatoire.' })
    .trim()
    .min(10, 'Le texte de présentation doit comporter au moins 10 caractères.')
    .max(2000, 'Le texte de présentation ne peut excéder 2000 caractères.'),
  videoUrl: z.string().trim().max(300).optional().default(''),
});

export const moderateCandidateSchema = z.object({
  status: z.enum([CANDIDATE_STATUS.APPROVED, CANDIDATE_STATUS.REJECTED], {
    required_error: 'Le statut de modération est obligatoire.',
  }),
  reviewNotes: z.string().trim().max(500).optional().default(''),
});

export const updateCandidateSchema = createCandidateSchema.partial();
