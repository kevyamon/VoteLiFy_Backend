import mongoose from 'mongoose';

const electionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Le titre de l'élection est obligatoire."],
      trim: true,
      maxlength: [150, 'Le titre ne peut excéder 150 caractères.'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'La description ne peut excéder 1000 caractères.'],
    },
    candidatePeriodOpen: {
      type: Boolean,
      default: false,
      index: true,
    },
    candidateStartAt: {
      type: Date,
      default: null,
    },
    candidateEndAt: {
      type: Date,
      default: null,
    },
    votingOpen: {
      type: Boolean,
      default: false,
      index: true,
    },
    votingStartAt: {
      type: Date,
      default: null,
    },
    votingEndAt: {
      type: Date,
      default: null,
    },
    resultsPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    resultsPublishAt: {
      type: Date,
      default: null,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    timezone: {
      type: String,
      default: 'Africa/Abidjan',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Propriété virtuelle calculant les 2 premières lettres pour l'illustration de la carte.
 */
electionSchema.virtual('initials').get(function () {
  if (!this.title) return 'EL';
  const clean = this.title.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '');
  return clean.slice(0, 2).toUpperCase() || 'EL';
});

export const Election = mongoose.model('Election', electionSchema);
