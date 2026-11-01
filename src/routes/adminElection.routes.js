import { Router } from 'express';
import {
  updateSettings,
  openVoting,
  closeVoting,
  openCandidacies,
  closeCandidacies,
  publishResults,
  unpublishResults,
  getAdminDashboardStats,
} from '../controllers/election.controller.js';
import {
  listAllElectionsController,
  createElectionAdminController,
  updateElectionAdminController,
} from '../controllers/multiElection.controller.js';
import {
  getTallyAdminController,
  resetTestDataAdminController,
} from '../controllers/vote.controller.js';
import {
  getAllPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from '../controllers/position.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  updateElectionSettingsSchema,
  createElectionSchema,
  createPositionSchema,
  updatePositionSchema,
  adminResetVotesSchema,
} from '../validations/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';


const router = Router();

// Toutes les routes suivantes exigent l'authentification de la Commission Électorale
router.use(requireAdminAuth);

// Tableau de bord synthétique
router.get('/dashboard', asyncHandler(getAdminDashboardStats));

// Gestion multi-élections
router.get('/elections', asyncHandler(listAllElectionsController));
router.post('/elections', validateBody(createElectionSchema), asyncHandler(createElectionAdminController));
router.patch('/elections/:id', validateBody(updateElectionSettingsSchema), asyncHandler(updateElectionAdminController));

// Pilotage du scrutin et des périodes électorales (scrutin actif)
router.patch('/election/settings', validateBody(updateElectionSettingsSchema), asyncHandler(updateSettings));
router.post('/election/open-voting', asyncHandler(openVoting));
router.post('/election/close-voting', asyncHandler(closeVoting));
router.post('/election/open-candidates', asyncHandler(openCandidacies));
router.post('/election/close-candidates', asyncHandler(closeCandidacies));
router.post('/election/publish-results', asyncHandler(publishResults));
router.post('/election/unpublish-results', asyncHandler(unpublishResults));


// Dépouillement confidentiel et réinitialisation protégée
router.get('/election/tally', asyncHandler(getTallyAdminController));
router.post('/election/reset', validateBody(adminResetVotesSchema), asyncHandler(resetTestDataAdminController));

// Gestion administrative des postes à pourvoir
router.get('/positions', asyncHandler(getAllPositions));
router.post('/positions', validateBody(createPositionSchema), asyncHandler(createPosition));
router.patch('/positions/:id', validateBody(updatePositionSchema), asyncHandler(updatePosition));
router.delete('/positions/:id', asyncHandler(deletePosition));

export default router;
