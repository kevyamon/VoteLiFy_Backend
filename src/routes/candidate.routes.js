import { Router } from 'express';
import {
  getPublicCandidates,
  getPublicCandidateById,
  submitCandidacy,
} from '../controllers/candidate.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { createCandidateSchema } from '../validations/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Consultation publique des candidats approuvés
router.get('/candidates', asyncHandler(getPublicCandidates));
router.get('/candidates/:id', asyncHandler(getPublicCandidateById));

// Dépôt public de candidature
router.post('/candidates', validateBody(createCandidateSchema), asyncHandler(submitCandidacy));

export default router;
