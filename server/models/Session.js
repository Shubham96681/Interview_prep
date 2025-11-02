const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 15,
    max: 480, // 8 hours max
    default: 60 // 1 hour default
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'pending'
  },
  sessionType: {
    type: String,
    enum: ['mock-interview', 'resume-review', 'career-guidance', 'skill-assessment', 'other'],
    required: true
  },
  meetingLink: {
    type: String,
    default: ''
  },
  meetingId: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  paymentId: {
    type: String,
    default: ''
  },
  notes: {
    candidate: {
      type: String,
      maxlength: 500,
      default: ''
    },
    expert: {
      type: String,
      maxlength: 500,
      default: ''
    }
  },
  feedback: {
    candidate: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, maxlength: 500 }
    },
    expert: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, maxlength: 500 }
    }
  },
  attachments: [{
    name: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reminders: [{
    type: { type: String, enum: ['email', 'sms', 'push'] },
    sentAt: Date,
    status: { type: String, enum: ['sent', 'failed', 'pending'] }
  }],
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
sessionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
sessionSchema.index({ candidate: 1, scheduledDate: 1 });
sessionSchema.index({ expert: 1, scheduledDate: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ scheduledDate: 1 });

module.exports = mongoose.model('Session', sessionSchema);

