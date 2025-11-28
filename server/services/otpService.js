// In-memory OTP storage with expiration
// In production, consider using Redis or database for persistence

class OTPService {
  constructor() {
    // Store OTPs: { email: { otp, expiresAt, userData } }
    this.otpStore = new Map();
    
    // Clean up expired OTPs every 5 minutes
    setInterval(() => {
      this.cleanupExpiredOTPs();
    }, 5 * 60 * 1000);
  }

  /**
   * Generate a 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Store OTP with expiration (10 minutes)
   */
  storeOTP(email, userData) {
    const otp = this.generateOTP();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    this.otpStore.set(email, {
      otp,
      expiresAt,
      userData,
      createdAt: Date.now()
    });
    
    console.log(`✅ OTP stored for ${email}, expires at ${new Date(expiresAt).toISOString()}`);
    return otp;
  }

  /**
   * Verify OTP
   */
  verifyOTP(email, otp) {
    const stored = this.otpStore.get(email);
    
    if (!stored) {
      console.log(`❌ No OTP found for ${email}`);
      return { valid: false, error: 'OTP not found. Please request a new one.' };
    }
    
    if (Date.now() > stored.expiresAt) {
      console.log(`❌ OTP expired for ${email}`);
      this.otpStore.delete(email);
      return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }
    
    if (stored.otp !== otp) {
      console.log(`❌ Invalid OTP for ${email}`);
      return { valid: false, error: 'Invalid OTP. Please try again.' };
    }
    
    // OTP is valid, return user data and remove OTP
    const userData = stored.userData;
    this.otpStore.delete(email);
    console.log(`✅ OTP verified for ${email}`);
    
    return { valid: true, userData };
  }

  /**
   * Get stored user data without verifying (for resending OTP)
   */
  getUserData(email) {
    const stored = this.otpStore.get(email);
    if (!stored || Date.now() > stored.expiresAt) {
      return null;
    }
    return stored.userData;
  }

  /**
   * Clean up expired OTPs
   */
  cleanupExpiredOTPs() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [email, data] of this.otpStore.entries()) {
      if (now > data.expiresAt) {
        this.otpStore.delete(email);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired OTP(s)`);
    }
  }

  /**
   * Resend OTP (generate new one, keep same user data)
   */
  resendOTP(email) {
    const stored = this.otpStore.get(email);
    if (!stored) {
      return null;
    }
    
    // Generate new OTP but keep user data
    const newOtp = this.generateOTP();
    stored.otp = newOtp;
    stored.expiresAt = Date.now() + (10 * 60 * 1000); // Reset expiration
    stored.createdAt = Date.now();
    
    console.log(`🔄 OTP resent for ${email}`);
    return newOtp;
  }
}

module.exports = new OTPService();

