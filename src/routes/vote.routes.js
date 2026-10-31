import { Router } from 'express';
import { submitVoteController } from '../controllers/vote.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { submitVoteSchema } from '../validations/index.js';
import { strictRateLimiter } from '../middlewares/security.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Route de soumission du suffrage sous limitation stricte de tentatives (anti bruteforce PIN)
router.post('/votes/submit', strictRateLimiter, validateBody(submitVoteSchema), asyncHandler(submitVoteController));

export default router;
