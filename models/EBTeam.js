const mongoose = require('mongoose');

const EBTeamSchema = new mongoose.Schema(
  {
    year: {
      type: String,
      required: [true, 'EB yılı gereklidir'],
      unique: true,
      trim: true,
      // e.g. "2026-2027"
    },
    title: {
      type: String,
      required: [true, 'EB başlığı gereklidir'],
      trim: true,
      // e.g. "AIESEC İstanbul 26.27 EB"
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      // e.g. "2026-2027"
    },
    description: {
      type: String,
      trim: true,
    },
    coverImage: {
      type: String,
      default: '/images/default-cover.jpg',
    },
    groupPhoto: {
      type: String,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
      // false = only approved users can view details
    },
    achievements: [
      {
        type: String,
        trim: true,
      },
    ],
    order: {
      type: Number,
      default: 0,
      // Higher = shows first (newest first)
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate slug from year before save
EBTeamSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = this.year.replace(/\s+/g, '-').toLowerCase();
  }
  next();
});

module.exports = mongoose.models.EBTeam || mongoose.model('EBTeam', EBTeamSchema);
