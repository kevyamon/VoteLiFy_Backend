import app from './src/app.js';
import { env } from './src/config/env.js';
import { connectDatabase, disconnectDatabase } from './src/config/database.js';

let server;

/**
 * Amorçage du serveur HTTP et connexion à la base de données.
 */
const startServer = async () => {
  // Connexion préalable à MongoDB
  await connectDatabase();

  server = app.listen(env.PORT, () => {
    console.log(`🚀 Serveur VoteLiFy démarré avec succès.`);
    console.log(`📡 URL locale : http://localhost:${env.PORT}`);
    console.log(`🌍 Mode d'exécution : [${env.NODE_ENV}]`);
  });
};

/**
 * Procédure d'arrêt gracieux du processus serveur.
 * 
 * @param {string} signal - Signal d'interruption reçu
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Signal ${signal} reçu. Arrêt gracieux en cours...`);

  if (server) {
    server.close(async () => {
      console.log('🔌 Serveur HTTP arrêté.');
      await disconnectDatabase();
      console.log('👋 Processus VoteLiFy terminé proprement.');
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }

  // Forcer l'arrêt si les connexions ne se ferment pas dans les 10 secondes
  setTimeout(() => {
    console.error("⏳ Délai d'arrêt dépassé. Fermeture forcée du processus.");
    process.exit(1);
  }, 10000);
};

// Écoute des signaux d'arrêt système
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Capture des rejets non traités
process.on('unhandledRejection', (reason) => {
  console.error('💥 Rejet de promesse non intercepté :', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Exception non capturée critique :', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

startServer();
