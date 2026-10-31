import { Router } from 'express';
import { getPublicResults } from '../controllers/results.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Route publique de consultation des résultats officiels
router.get('/results', asyncHandler(getPublicResults));

export default router;
