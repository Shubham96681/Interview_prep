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
   * @param {string} email - User email
   * @param {object} userData - User data (for registration) or null (for password reset)
   * @param {string} type - 'registration' or 'password-reset'
   */
  storeOTP(email, userData, type = 'registration') {
    const otp = this.generateOTP();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    // Use different key prefix for password reset to avoid conflicts
    const key = type === 'password-reset' ? `reset_${email}` : email;
    
    this.otpStore.set(key, {
      otp,
      expiresAt,
      userData,
      type,
      createdAt: Date.now()
    });
    
    console.log(`✅ ${type} OTP stored for ${email}, expires at ${new Date(expiresAt).toISOString()}`);
    return otp;
  }

  /**
   * Verify OTP
   * @param {string} email - User email
   * @param {string} otp - OTP code
   * @param {string} type - 'registration' or 'password-reset'
   */
  verifyOTP(email, otp, type = 'registration') {
    const key = type === 'password-reset' ? `reset_${email}` : email;
    const stored = this.otpStore.get(key);
    
    if (!stored) {
      console.log(`❌ No ${type} OTP found for ${email}`);
      return { valid: false, error: 'OTP not found. Please request a new one.' };
    }
    
    if (stored.type !== type) {
      console.log(`❌ OTP type mismatch for ${email}`);
      return { valid: false, error: 'Invalid OTP type. Please request a new one.' };
    }
    
    if (Date.now() > stored.expiresAt) {
      console.log(`❌ ${type} OTP expired for ${email}`);
      this.otpStore.delete(key);
      return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }
    
    if (stored.otp !== otp) {
      console.log(`❌ Invalid ${type} OTP for ${email}`);
      return { valid: false, error: 'Invalid OTP. Please try again.' };
    }
    
    // OTP is valid, return user data (if any) and remove OTP
    const userData = stored.userData;
    this.otpStore.delete(key);
    console.log(`✅ ${type} OTP verified for ${email}`);
    
    return { valid: true, userData };
  }

  /**
   * Get stored user data without verifying (for resending OTP)
   * @param {string} email - User email
   * @param {string} type - 'registration' or 'password-reset'
   */
  getUserData(email, type = 'registration') {
    const key = type === 'password-reset' ? `reset_${email}` : email;
    const stored = this.otpStore.get(key);
    if (!stored || Date.now() > stored.expiresAt || stored.type !== type) {
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
   * @param {string} email - User email
   * @param {string} type - 'registration' or 'password-reset'
   */
  resendOTP(email, type = 'registration') {
    const key = type === 'password-reset' ? `reset_${email}` : email;
    const stored = this.otpStore.get(key);
    if (!stored || stored.type !== type) {
      return null;
    }
    
    // Generate new OTP but keep user data
    const newOtp = this.generateOTP();
    stored.otp = newOtp;
    stored.expiresAt = Date.now() + (10 * 60 * 1000); // Reset expiration
    stored.createdAt = Date.now();
    
    console.log(`🔄 ${type} OTP resent for ${email}`);
    return newOtp;
  }
}

module.exports = new OTPService();

