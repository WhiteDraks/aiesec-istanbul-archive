const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ad Soyad gereklidir'],
      trim: true,
      minlength: [2, 'Ad en az 2 karakter olmalıdır'],
      maxlength: [100, 'Ad en fazla 100 karakter olabilir'],
    },
    email: {
      type: String,
      required: [true, 'E-posta gereklidir'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Geçerli bir e-posta adresi giriniz'],
    },
    password: {
      type: String,
      required: [true, 'Şifre gereklidir'],
      minlength: [6, 'Şifre en az 6 karakter olmalıdır'],
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Optional profile info
    school: {
      type: String,
      trim: true,
    },
    ebYear: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for display status in Turkish
UserSchema.virtual('statusLabel').get(function () {
  const labels = {
    pending: 'Onay Bekliyor',
    approved: 'Onaylı',
    rejected: 'Reddedildi',
  };
  return labels[this.status] || this.status;
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
