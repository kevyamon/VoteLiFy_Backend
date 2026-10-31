import { z } from 'zod';

export const adminRegisterSchema = z.object({
  username: z
    .string({ required_error: "L'identifiant administrateur est obligatoire." })
    .trim()
    .min(3, "L'identifiant doit comporter au moins 3 caractères.")
    .max(50, "L'identifiant ne peut excéder 50 caractères."),
  password: z
    .string({ required_error: 'Le mot de passe est obligatoire.' })
    .min(8, 'Le mot de passe doit comporter au moins 8 caractères.'),
  adminSecret: z
    .string({ required_error: "Le secret d'initialisation AD_PW est obligatoire." })
    .min(1, 'La clé de sécurité administrateur est requise.'),
});

export const adminLoginSchema = z.object({
  username: z.string({ required_error: "L'identifiant est obligatoire." }).trim().min(1),
  password: z.string({ required_error: 'Le mot de passe est obligatoire.' }).min(1),
});

export const adminResetVotesSchema = z.object({
  password: z.string({ required_error: 'Le mot de passe administrateur est obligatoire pour confirmer la réinitialisation.' }).min(1),
});
