const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  role: { 
    type: String, 
    enum: ['candidate', 'expert'], 
    required: true 
  },
  profile: {
    bio: { 
      type: String, 
      maxlength: 500,
      default: ''
    },
    experience: { 
      type: String, 
      maxlength: 200,
      default: ''
    },
    skills: { 
      type: [String], 
      default: [],
      validate: {
        validator: function(v) {
          return v.length <= 20;
        },
        message: 'Cannot have more than 20 skills'
      }
    },
    rating: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 5
    },
    totalSessions: { 
      type: Number, 
      default: 0,
      min: 0
    },
    hourlyRate: {
      type: Number,
      min: 0,
      default: 0
    },
    profilePicture: {
      type: String,
      default: ''
    },
    availability: {
      timezone: { type: String, default: 'UTC' },
      workingHours: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '17:00' }
      },
      daysAvailable: {
        type: [String],
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      }
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationDocuments: [{
      type: { type: String, enum: ['resume', 'certificate', 'portfolio'] },
      url: String,
      uploadedAt: { type: Date, default: Date.now }
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update updatedAt field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Transform JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);

