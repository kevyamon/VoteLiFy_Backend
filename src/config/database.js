import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Gestionnaire résilient de connexion à la base de données MongoDB.
 * Supervise les événements réseau et garantit une persistance fiable.
 */
export const connectDatabase = async () => {
  try {
    mongoose.connection.on('connected', () => {
      console.log('✅ Connexion à MongoDB Atlas établie avec succès.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur de liaison avec MongoDB :', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ Connexion MongoDB interrompue. Tentative de reconnexion en cours...');
    });

    await mongoose.connect(env.MONGO_URI, {
      autoIndex: env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    console.error('❌ Échec critique lors de la connexion initiale à MongoDB :', error.message);
    process.exit(1);
  }
};

/**
 * Fermeture propre des connexions lors des signaux d'arrêt du processus.
 */
export const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log('🔒 Connexion MongoDB clôturée proprement.');
  } catch (error) {
    console.error('❌ Erreur lors de la fermeture de la connexion MongoDB :', error.message);
  }
};
