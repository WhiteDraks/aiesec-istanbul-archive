const mongoose = require('mongoose');

const EBMemberSchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EBTeam',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Üye adı gereklidir'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Görev gereklidir'],
      trim: true,
      // e.g. "Local Committee President", "VP of Outgoing Global Talent"
    },
    department: {
      type: String,
      trim: true,
      // e.g. "Outgoing Global Talent", "Marketing"
    },
    school: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    linkedin: {
      type: String,
      trim: true,
    },
    aiesecJourney: {
      type: String,
      trim: true,
      // Short description of their AIESEC journey
    },
    bio: {
      type: String,
      trim: true,
      // Short biography
    },
    photo: {
      type: String,
      default: '/images/default-avatar.svg',
    },
    // Special ordering: Elif Kurnaz always appears last
    isPinToBottom: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 100,
      // Lower = appears first
    },
    // Gallery images for this member (optional)
    gallery: [
      {
        url: String,
        caption: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient team+order queries
EBMemberSchema.index({ team: 1, order: 1, isPinToBottom: 1 });

module.exports =
  mongoose.models.EBMember || mongoose.model('EBMember', EBMemberSchema);
