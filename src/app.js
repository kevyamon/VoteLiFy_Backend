import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { HTTP_STATUS } from './config/constants.js';
import { sendSuccess, sendError } from './utils/apiResponse.js';
import { errorHandler } from './middlewares/error.middleware.js';
import {
  corsMiddleware,
  helmetMiddleware,
  globalRateLimiter,
} from './middlewares/security.middleware.js';
import adminAuthRoutes from './routes/adminAuth.routes.js';
import publicElectionRoutes from './routes/publicElection.routes.js';
import adminElectionRoutes from './routes/adminElection.routes.js';
import adminVoterRoutes from './routes/adminVoter.routes.js';
import candidateRoutes from './routes/candidate.routes.js';
import adminCandidateRoutes from './routes/adminCandidate.routes.js';
import voteRoutes from './routes/vote.routes.js';
import resultsRoutes from './routes/results.routes.js';

const app = express();

// 1. En-têtes de sécurité et CORS
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.options('*', corsMiddleware);

// 2. Journalisation en développement
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 3. Décodage des charges utiles HTTP et des cookies
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// 4. Limiteur global de requêtes
app.use('/api', globalRateLimiter);

// 5. Point de contrôle d'intégrité (Health Check)
app.get('/api/health', (req, res) => {
  return sendSuccess(
    res,
    {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    },
    'Service VoteLiFy API opérationnel.'
  );
});

// 6. Routes publiques de consultation du scrutin, des postes, candidatures, soumission de vote et résultats
app.use('/api', publicElectionRoutes);
app.use('/api', candidateRoutes);
app.use('/api', voteRoutes);
app.use('/api', resultsRoutes);

// 7. Routes d'authentification et de gestion administrative de la Commission Électorale
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin', adminElectionRoutes);
app.use('/api/admin', adminVoterRoutes);
app.use('/api/admin', adminCandidateRoutes);

// 8. Gestion des routes non trouvées (404)
app.use('*', (req, res) => {
  return sendError(
    res,
    `La ressource demandée [${req.method}] ${req.originalUrl} n'existe pas sur ce serveur.`,
    HTTP_STATUS.NOT_FOUND,
    null,
    'RESOURCE_NOT_FOUND'
  );
});

// 9. Middleware centralisé d'interception d'erreurs
app.use(errorHandler);

export default app;
