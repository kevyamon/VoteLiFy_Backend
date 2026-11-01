import { Router } from 'express';
import { getPublicElectionInfo } from '../controllers/election.controller.js';
import {
  listAllElectionsController,
  getElectionDetailController,
} from '../controllers/multiElection.controller.js';
import { getPublicPositions } from '../controllers/position.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Liste de l'ensemble des élections disponibles
router.get('/elections', asyncHandler(listAllElectionsController));

// Détail et statut temporel d'une élection spécifique
router.get('/elections/:id', asyncHandler(getElectionDetailController));

// Consultation publique des statuts temporels du scrutin par défaut (rétrocompatibilité)
router.get('/election', asyncHandler(getPublicElectionInfo));

// Consultation publique des postes à pourvoir
router.get('/positions', asyncHandler(getPublicPositions));

export default router;

