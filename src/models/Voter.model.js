import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { PIN_STATUS } from '../config/constants.js';

const voterSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Le numéro de téléphone est obligatoire.'],
      unique: true,
      trim: true,
      index: true,
    },
    pinHash: {
      type: String,
      required: [true, "L'empreinte du code PIN est obligatoire."],
      select: false, // Ne jamais exposer par défaut dans les requêtes de lecture
    },
    hasVoted: {
      type: Boolean,
      default: false,
      index: true,
    },
    pinStatus: {
      type: String,
      enum: Object.values(PIN_STATUS),
      default: PIN_STATUS.ACTIVE,
      index: true,
    },
    votedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Compare un code PIN brut avec l'empreinte cryptographique stockée.
 * 
 * @param {string} rawPin - Code PIN fourni par l'électeur
 * @returns {Promise<boolean>}
 */
voterSchema.methods.comparePin = async function (rawPin) {
  return bcrypt.compare(String(rawPin), this.pinHash);
};

export const Voter = mongoose.model('Voter', voterSchema);
