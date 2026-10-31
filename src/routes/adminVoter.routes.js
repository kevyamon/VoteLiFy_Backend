import { Router } from 'express';
import {
  previewVotersController,
  importVotersController,
  getVotersController,
  exportVotersController,
} from '../controllers/voter.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { previewVotersSchema, importVotersSchema } from '../validations/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Toutes les opérations sur le registre des électeurs requièrent l'authentification Commission Électorale
router.use(requireAdminAuth);

router.post('/voters/preview', validateBody(previewVotersSchema), asyncHandler(previewVotersController));
router.post('/voters/import', validateBody(importVotersSchema), asyncHandler(importVotersController));
router.get('/voters', asyncHandler(getVotersController));
router.get('/voters/export', asyncHandler(exportVotersController));

export default router;
