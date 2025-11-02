const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  categories: {
    professionalism: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    expertise: { type: Number, min: 1, max: 5 },
    punctuality: { type: Number, min: 1, max: 5 },
    helpfulness: { type: Number, min: 1, max: 5 }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt field before saving
reviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1 });
reviewSchema.index({ session: 1 }, { unique: true }); // One review per session

// Ensure one review per session per reviewer
reviewSchema.index({ session: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

