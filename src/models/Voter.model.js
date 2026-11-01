import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { PIN_STATUS } from '../config/constants.js';

const voterSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Le numéro de téléphone est obligatoire.'],
      trim: true,
      index: true,
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      index: true,
      default: null,
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
    votedElections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Election',
        default: [],
      },
    ],
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

// Index composite garantissant l'unicité de l'électeur par élection
voterSchema.index({ phone: 1, electionId: 1 }, { unique: true });
voterSchema.index({ electionId: 1, pinStatus: 1, hasVoted: 1 });

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
