import mongoose from 'mongoose';

const electionSettingsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Le titre de l'élection est obligatoire."],
      trim: true,
      default: 'Élection des responsables — Promotion Formation No-Code',
      maxlength: [150, 'Le titre ne peut excéder 150 caractères.'],
    },
    description: {
      type: String,
      trim: true,
      default: 'Scrutin officiel et confidentiel de la communauté FORMATION NO-CODE.',
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
    timezone: {
      type: String,
      default: 'Africa/Abidjan',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Méthode statique assurant la persistance d'une instance unique de configuration (Singleton).
 */
electionSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const ElectionSettings = mongoose.model('ElectionSettings', electionSettingsSchema);
