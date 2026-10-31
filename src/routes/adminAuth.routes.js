import { Router } from 'express';
import {
  registerInitialAdmin,
  loginAdmin,
  logoutAdmin,
  getMe,
} from '../controllers/adminAuth.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { adminRegisterSchema, adminLoginSchema } from '../validations/index.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { strictRateLimiter } from '../middlewares/security.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Routes publiques d'accès avec protection anti-bruteforce stricte
router.post('/register', strictRateLimiter, validateBody(adminRegisterSchema), asyncHandler(registerInitialAdmin));
router.post('/login', strictRateLimiter, validateBody(adminLoginSchema), asyncHandler(loginAdmin));

// Routes protégées par authentification de la Commission Électorale
router.post('/logout', requireAdminAuth, asyncHandler(logoutAdmin));
router.get('/me', requireAdminAuth, asyncHandler(getMe));

export default router;
