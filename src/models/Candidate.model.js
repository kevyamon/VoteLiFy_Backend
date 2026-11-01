import mongoose from 'mongoose';
import { CANDIDATE_STATUS } from '../config/constants.js';

const candidateSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Le nom et prénom du candidat sont obligatoires.'],
      trim: true,
      minlength: [2, 'Le nom complet doit comporter au moins 2 caractères.'],
      maxlength: [120, 'Le nom complet ne peut excéder 120 caractères.'],
    },
    phone: {
      type: String,
      required: [true, 'Le numéro WhatsApp du candidat est obligatoire.'],
      trim: true,
      index: true,
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      index: true,
      default: null,
    },
    positionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      required: [true, 'Le poste convoité est obligatoire.'],
      index: true,
    },
    photoUrl: {
      type: String,
      required: [true, 'La photo officielle est obligatoire.'],
      trim: true,
    },
    pitch: {
      type: String,
      required: [true, 'Le pitch et programme de candidature sont obligatoires.'],
      trim: true,
      maxlength: [2000, 'Le texte du programme ne peut excéder 2000 caractères.'],
    },
    videoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(CANDIDATE_STATUS),
      default: CANDIDATE_STATUS.PENDING,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index composite garantissant qu'un candidat ne candidate qu'une fois par élection
candidateSchema.index({ phone: 1, electionId: 1 }, { unique: true });

// Index composite optimisant l'affichage public des candidats validés par scrutin et par poste
candidateSchema.index({ electionId: 1, status: 1, positionId: 1 });

export const Candidate = mongoose.model('Candidate', candidateSchema);
