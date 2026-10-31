import { Router } from 'express';
import { getPublicElectionInfo } from '../controllers/election.controller.js';
import { getPublicPositions } from '../controllers/position.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Consultation publique des statuts temporels du scrutin et des comptes à rebours
router.get('/election', asyncHandler(getPublicElectionInfo));

// Consultation publique des postes à pourvoir
router.get('/positions', asyncHandler(getPublicPositions));

export default router;
