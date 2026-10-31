import { z } from 'zod';

export const updateElectionSettingsSchema = z.object({
  title: z.string().trim().min(3, "Le titre de l'élection doit comporter au moins 3 caractères.").max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  candidatePeriodOpen: z.boolean().optional(),
  candidateStartAt: z.coerce.date().nullable().optional(),
  candidateEndAt: z.coerce.date().nullable().optional(),
  votingOpen: z.boolean().optional(),
  votingStartAt: z.coerce.date().nullable().optional(),
  votingEndAt: z.coerce.date().nullable().optional(),
  resultsPublished: z.boolean().optional(),
  resultsPublishAt: z.coerce.date().nullable().optional(),
  timezone: z.string().trim().min(2).optional(),
});
