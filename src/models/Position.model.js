import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le libellé du poste est obligatoire.'],
      trim: true,
      unique: true,
      minlength: [2, 'Le nom du poste doit comporter au moins 2 caractères.'],
      maxlength: [100, 'Le nom du poste ne peut excéder 100 caractères.'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La description du poste ne peut excéder 500 caractères.'],
      default: '',
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

positionSchema.index({ isActive: 1, order: 1 });

export const Position = mongoose.model('Position', positionSchema);
