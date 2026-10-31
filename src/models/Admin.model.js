import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, SECURITY_CONFIG } from '../config/constants.js';

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "L'identifiant administrateur est obligatoire."],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, "L'identifiant doit comporter au moins 3 caractères."],
      maxlength: [50, "L'identifiant ne peut excéder 50 caractères."],
    },
    passwordHash: {
      type: String,
      required: [true, 'Le mot de passe haché est obligatoire.'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.ADMIN,
      immutable: true, // Empêche toute modification de rôle arbitraire
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
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
 * Hache un mot de passe avec Bcrypt au niveau de sécurité configuré (12 rounds).
 * 
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
adminSchema.statics.hashPassword = async function (plainPassword) {
  return bcrypt.hash(plainPassword, SECURITY_CONFIG.BCRYPT_SALT_ROUNDS);
};

/**
 * Compare un mot de passe en clair avec l'empreinte stockée.
 * 
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const Admin = mongoose.model('Admin', adminSchema);
