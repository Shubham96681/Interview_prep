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
    
    // Normalize email (lowercase) for consistent key lookup
    const normalizedEmail = email.toLowerCase().trim();
    
    // Use different key prefix for password reset to avoid conflicts
    const key = type === 'password-reset' ? `reset_${normalizedEmail}` : normalizedEmail;
    
    this.otpStore.set(key, {
      otp,
      expiresAt,
      userData,
      type,
      createdAt: Date.now(),
      verified: false // Track if OTP has been verified (for password reset flow)
    });
    
    console.log(`✅ ${type} OTP stored for ${normalizedEmail} (key: ${key}), OTP: ${otp}, expires at ${new Date(expiresAt).toISOString()}`);
    return otp;
  }

  /**
   * Verify OTP
   * @param {string} email - User email
   * @param {string} otp - OTP code
   * @param {string} type - 'registration' or 'password-reset'
   */
  verifyOTP(email, otp, type = 'registration') {
    // Normalize email (lowercase) and OTP (trim whitespace, remove non-digits)
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.toString().trim().replace(/\D/g, ''); // Remove all non-digits
    
    const key = type === 'password-reset' ? `reset_${normalizedEmail}` : normalizedEmail;
    const stored = this.otpStore.get(key);
    
    if (!stored) {
      console.log(`❌ No ${type} OTP found for ${normalizedEmail} (key: ${key})`);
      // Log all existing keys for debugging
      console.log(`📋 Available OTP keys:`, Array.from(this.otpStore.keys()));
      return { valid: false, error: 'OTP not found. Please request a new one.' };
    }
    
    if (stored.type !== type) {
      console.log(`❌ OTP type mismatch for ${normalizedEmail}: expected ${type}, got ${stored.type}`);
      return { valid: false, error: 'Invalid OTP type. Please request a new one.' };
    }
    
    if (Date.now() > stored.expiresAt) {
      console.log(`❌ ${type} OTP expired for ${normalizedEmail} (expired at ${new Date(stored.expiresAt).toISOString()})`);
      this.otpStore.delete(key);
      return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }
    
    // Compare normalized OTPs
    if (stored.otp !== normalizedOTP) {
      console.log(`❌ Invalid ${type} OTP for ${normalizedEmail}`);
      console.log(`   Expected: "${stored.otp}" (length: ${stored.otp.length})`);
      console.log(`   Received: "${normalizedOTP}" (length: ${normalizedOTP.length})`);
      console.log(`   Original input: "${otp}"`);
      return { valid: false, error: 'Invalid OTP. Please try again.' };
    }
    
    // OTP is valid
    const userData = stored.userData;
    
    // For password-reset type, mark as verified but don't delete yet (will be deleted after password reset)
    // For registration type, delete immediately after verification
    if (type === 'password-reset') {
      stored.verified = true;
      console.log(`✅ ${type} OTP verified for ${email} (marked as verified, will be deleted after password reset)`);
    } else {
      // Registration OTP: delete immediately after verification
      this.otpStore.delete(key);
      console.log(`✅ ${type} OTP verified for ${email}`);
    }
    
    return { valid: true, userData };
  }

  /**
   * Get stored user data without verifying (for resending OTP)
   * @param {string} email - User email
   * @param {string} type - 'registration' or 'password-reset'
   */
  getUserData(email, type = 'registration') {
    const normalizedEmail = email.toLowerCase().trim();
    const key = type === 'password-reset' ? `reset_${normalizedEmail}` : normalizedEmail;
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
    
    // Use the actual key from entries (not email, since password-reset uses reset_email format)
    for (const [key, data] of this.otpStore.entries()) {
      if (now > data.expiresAt) {
        this.otpStore.delete(key);
        cleaned++;
        console.log(`🗑️ Cleaned up expired ${data.type} OTP for key: ${key}`);
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
    const normalizedEmail = email.toLowerCase().trim();
    const key = type === 'password-reset' ? `reset_${normalizedEmail}` : normalizedEmail;
    const stored = this.otpStore.get(key);
    if (!stored || stored.type !== type) {
      return null;
    }
    
    // Check if expired - if so, don't resend, user needs to request new OTP
    if (Date.now() > stored.expiresAt) {
      console.log(`⏰ Cannot resend expired ${type} OTP for ${normalizedEmail}`);
      this.otpStore.delete(key);
      return null;
    }
    
    // Generate new OTP but keep user data
    const newOtp = this.generateOTP();
    stored.otp = newOtp;
    stored.expiresAt = Date.now() + (10 * 60 * 1000); // Reset expiration to 10 minutes from now
    stored.createdAt = Date.now();
    stored.verified = false; // Reset verified flag when resending
    
    console.log(`🔄 ${type} OTP resent for ${normalizedEmail}, new OTP: ${newOtp}, expires at ${new Date(stored.expiresAt).toISOString()}`);
    return newOtp;
  }

  /**
   * Check if OTP is verified (for password reset flow)
   * @param {string} email - User email
   * @param {string} type - 'registration' or 'password-reset'
   */
  isOTPVerified(email, type = 'password-reset') {
    const normalizedEmail = email.toLowerCase().trim();
    const key = type === 'password-reset' ? `reset_${normalizedEmail}` : normalizedEmail;
    const stored = this.otpStore.get(key);
    if (!stored || stored.type !== type) {
      return false;
    }
    // Check expiration first
    if (Date.now() > stored.expiresAt) {
      // OTP expired, delete it
      this.otpStore.delete(key);
      console.log(`⏰ ${type} OTP expired for ${normalizedEmail}, deleted`);
      return false;
    }
    return stored.verified === true;
  }

  /**
   * Delete verified OTP (after successful password reset)
   * @param {string} email - User email
   * @param {string} type - 'registration' or 'password-reset'
   */
  deleteOTP(email, type = 'password-reset') {
    const normalizedEmail = email.toLowerCase().trim();
    const key = type === 'password-reset' ? `reset_${normalizedEmail}` : normalizedEmail;
    const deleted = this.otpStore.delete(key);
    if (deleted) {
      console.log(`🗑️ ${type} OTP deleted for ${normalizedEmail}`);
    }
    return deleted;
  }
}

module.exports = new OTPService();

