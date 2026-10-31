import { Router } from 'express';
import {
  getAllCandidatesAdmin,
  getCandidateByIdAdmin,
  approveCandidate,
  rejectCandidate,
  updateCandidateAdmin,
  deleteCandidateAdmin,
} from '../controllers/candidate.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  moderateCandidateSchema,
  updateCandidateSchema,
} from '../validations/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Toutes les opérations suivantes sont protégées par l'authentification de la Commission Électorale
router.use(requireAdminAuth);

router.get('/candidates', asyncHandler(getAllCandidatesAdmin));
router.get('/candidates/:id', asyncHandler(getCandidateByIdAdmin));
router.patch('/candidates/:id/approve', asyncHandler(approveCandidate));
router.patch('/candidates/:id/reject', validateBody(moderateCandidateSchema), asyncHandler(rejectCandidate));
router.patch('/candidates/:id', validateBody(updateCandidateSchema), asyncHandler(updateCandidateAdmin));
router.delete('/candidates/:id', asyncHandler(deleteCandidateAdmin));

export default router;
