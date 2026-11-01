import mongoose from 'mongoose';

/**
 * Modèle Vote représentant un suffrage anonyme scellé.
 * 
 * RÈGLE D'OR DE CONFIDENTIALITÉ :
 * Ce document ne contient et ne doit jamais contenir la moindre référence à l'identité,
 * au numéro de téléphone, à l'adresse IP ou au code PIN de l'électeur.
 */
const voteSchema = new mongoose.Schema(
  {
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election',
      index: true,
      default: null,
    },
    positionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      required: [true, 'Le poste lié au vote est obligatoire.'],
      index: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: [true, 'Le candidat choisi est obligatoire.'],
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Index composite accélérant le dépouillement en direct et le calcul des résultats par élection
voteSchema.index({ electionId: 1, positionId: 1, candidateId: 1 });
voteSchema.index({ positionId: 1, candidateId: 1 });

export const Vote = mongoose.model('Vote', voteSchema);
