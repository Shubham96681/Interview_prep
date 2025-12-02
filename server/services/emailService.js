const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Gmail configuration
    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'testshubham6287@gmail.com',
          pass: 'xohf qieb wucb dpne' // App password
        }
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email service connection error:', error);
          console.error('❌ Email service error details:', error.message);
        } else {
          console.log('✅ Email service ready and verified');
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
      this.transporter = null;
    }
  }

  /**
   * Send OTP email for registration
   */
  async sendOTPEmail(email, name, otp) {
    try {
      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: email,
        subject: 'Verify Your Email - Interview Prep Platform',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
              .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Interview Prep Platform!</h1>
              </div>
              <div class="content">
                <p>Hello ${name},</p>
                <p>Thank you for registering with us! To complete your registration, please verify your email address using the OTP below:</p>
                
                <div class="otp-box">
                  <div class="otp-code">${otp}</div>
                </div>
                
                <div class="warning">
                  <strong>⚠️ Important:</strong> This OTP is valid for <strong>10 minutes</strong> only. Please use it before it expires.
                </div>
                
                <p>If you didn't create an account with us, please ignore this email.</p>
                
                <p>Best regards,<br>Interview Prep Platform Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending OTP email:', error);
      throw error;
    }
  }

  /**
   * Send successful registration confirmation email
   */
  async sendRegistrationSuccessEmail(email, name, userType) {
    try {
      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: email,
        subject: 'Registration Successful - Welcome to Interview Prep Platform!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Registration Successful!</h1>
              </div>
              <div class="content">
                <div class="success-icon">✅</div>
                <p>Hello ${name},</p>
                <p>Congratulations! Your email has been verified and your account has been successfully created.</p>
                <p>You are registered as a <strong>${userType === 'expert' ? 'Expert' : 'Candidate'}</strong> on our platform.</p>
                <p>You can now:</p>
                <ul>
                  ${userType === 'expert' 
                    ? '<li>Set up your expert profile</li><li>Set your availability</li><li>Start receiving interview requests</li>'
                    : '<li>Browse expert profiles</li><li>Book interview sessions</li><li>Prepare for your interviews</li>'
                  }
                </ul>
                <p>We're excited to have you on board!</p>
                <p>Best regards,<br>Interview Prep Platform Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Registration success email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending registration success email:', error);
      throw error;
    }
  }

  /**
   * Send meeting booking confirmation to candidate
   */
  async sendMeetingBookingEmailToCandidate(candidateEmail, candidateName, expertName, session) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }
    
    try {
      console.log(`📧 Preparing to send booking email to candidate: ${candidateEmail}`);
      const scheduledDate = new Date(session.scheduledDate);
      const formattedDate = scheduledDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = scheduledDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: candidateEmail,
        subject: `Interview Session Booked - ${formattedDate}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .meeting-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #667eea; }
              .detail-row { margin: 10px 0; }
              .detail-label { font-weight: bold; color: #667eea; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📅 Interview Session Booked!</h1>
              </div>
              <div class="content">
                <p>Hello ${candidateName},</p>
                <p>Your interview session has been successfully booked!</p>
                
                <div class="meeting-details">
                  <h3>Meeting Details:</h3>
                  <div class="detail-row">
                    <span class="detail-label">Expert:</span> ${expertName}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Date:</span> ${formattedDate}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Time:</span> ${formattedTime}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span> ${session.duration} minutes
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Session Type:</span> ${session.sessionType || 'Technical Interview'}
                  </div>
                  ${session.title ? `<div class="detail-row"><span class="detail-label">Title:</span> ${session.title}</div>` : ''}
                </div>
                
                <p>Please make sure to:</p>
                <ul>
                  <li>Join the meeting on time</li>
                  <li>Test your microphone and camera beforehand</li>
                  <li>Have a stable internet connection</li>
                  <li>Prepare any materials you might need</li>
                </ul>
                
                <p>We look forward to your session!</p>
                <p>Best regards,<br>Interview Prep Platform Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Meeting booking email sent to candidate:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending meeting booking email to candidate:', error);
      throw error;
    }
  }

  /**
   * Send meeting booking notification to expert
   */
  async sendMeetingBookingEmailToExpert(expertEmail, expertName, candidateName, session) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }
    
    try {
      console.log(`📧 Preparing to send booking email to expert: ${expertEmail}`);
      const scheduledDate = new Date(session.scheduledDate);
      const formattedDate = scheduledDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = scheduledDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: expertEmail,
        subject: `New Interview Session Booked - ${formattedDate}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .meeting-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #667eea; }
              .detail-row { margin: 10px 0; }
              .detail-label { font-weight: bold; color: #667eea; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📅 New Interview Session Booked</h1>
              </div>
              <div class="content">
                <p>Hello ${expertName},</p>
                <p>A new interview session has been booked with you!</p>
                
                <div class="meeting-details">
                  <h3>Meeting Details:</h3>
                  <div class="detail-row">
                    <span class="detail-label">Candidate:</span> ${candidateName}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Date:</span> ${formattedDate}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Time:</span> ${formattedTime}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span> ${session.duration} minutes
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Session Type:</span> ${session.sessionType || 'Technical Interview'}
                  </div>
                  ${session.title ? `<div class="detail-row"><span class="detail-label">Title:</span> ${session.title}</div>` : ''}
                </div>
                
                <p>Please make sure to:</p>
                <ul>
                  <li>Confirm your availability for this time</li>
                  <li>Prepare your interview questions and materials</li>
                  <li>Test your equipment before the session</li>
                </ul>
                
                <p>You can reschedule this meeting if needed from your dashboard.</p>
                
                <p>Best regards,<br>Interview Prep Platform Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Meeting booking email sent to expert:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending meeting booking email to expert:', error);
      throw error;
    }
  }

  /**
   * Send meeting reschedule notification to candidate
   */
  async sendMeetingRescheduleEmailToCandidate(candidateEmail, candidateName, expertName, oldSession, newScheduledDate) {
    try {
      const oldDate = new Date(oldSession.scheduledDate);
      const newDate = new Date(newScheduledDate);
      
      const formattedOldDate = oldDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedOldTime = oldDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      
      const formattedNewDate = newDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedNewTime = newDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: candidateEmail,
        subject: `Interview Session Rescheduled - ${formattedNewDate}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .meeting-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
              .old-time { background: #ffe6e6; border-left: 4px solid #ff6b6b; padding: 15px; margin: 10px 0; }
              .new-time { background: #e6f7e6; border-left: 4px solid #51cf66; padding: 15px; margin: 10px 0; }
              .detail-row { margin: 10px 0; }
              .detail-label { font-weight: bold; color: #667eea; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔄 Interview Session Rescheduled</h1>
              </div>
              <div class="content">
                <p>Hello ${candidateName},</p>
                <p>Your interview session with <strong>${expertName}</strong> has been rescheduled.</p>
                
                <div class="meeting-details">
                  <div class="old-time">
                    <strong>❌ Previous Time:</strong><br>
                    ${formattedOldDate}<br>
                    ${formattedOldTime}
                  </div>
                  
                  <div class="new-time">
                    <strong>✅ New Time:</strong><br>
                    ${formattedNewDate}<br>
                    ${formattedNewTime}
                  </div>
                  
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span> ${oldSession.duration} minutes
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Session Type:</span> ${oldSession.sessionType || 'Technical Interview'}
                  </div>
                </div>
                
                <p>Please update your calendar with the new time. We apologize for any inconvenience.</p>
                
                <p>Best regards,<br>Interview Prep Platform Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Meeting reschedule email sent to candidate:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending meeting reschedule email to candidate:', error);
      throw error;
    }
  }

  /**
   * Send meeting reminder email to candidate (1 hour before)
   */
  async sendMeetingReminderEmailToCandidate(candidateEmail, candidateName, expertName, session) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }
    
    try {
      console.log(`📧 Preparing to send reminder email to candidate: ${candidateEmail}`);
      const scheduledDate = new Date(session.scheduledDate);
      const formattedDate = scheduledDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = scheduledDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: candidateEmail,
        subject: `⏰ Reminder: Interview Session in 1 Hour - ${formattedDate}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .reminder-box { background: #fff3cd; border-left: 4px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 5px; }
              .meeting-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #667eea; }
              .detail-row { margin: 10px 0; }
              .detail-label { font-weight: bold; color: #667eea; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⏰ Interview Session Reminder</h1>
              </div>
              <div class="content">
                <div class="reminder-box">
                  <h2 style="margin-top: 0; color: #f57c00;">Your interview session starts in 1 hour!</h2>
                </div>
                
                <p>Hello ${candidateName},</p>
                <p>This is a friendly reminder that your interview session is scheduled to begin in <strong>1 hour</strong>.</p>
                
                <div class="meeting-details">
                  <h3>Meeting Details:</h3>
                  <div class="detail-row">
                    <span class="detail-label">Expert:</span> ${expertName}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Date:</span> ${formattedDate}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Time:</span> ${formattedTime}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span> ${session.duration} minutes
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Session Type:</span> ${session.sessionType || 'Technical Interview'}
                  </div>
                  ${session.title ? `<div class="detail-row"><span class="detail-label">Title:</span> ${session.title}</div>` : ''}
                </div>
                
                <p><strong>Please prepare:</strong></p>
                <ul>
                  <li>✅ Test your microphone and camera</li>
                  <li>✅ Ensure a stable internet connection</li>
                  <li>✅ Have your materials ready</li>
                  <li>✅ Join the meeting 5 minutes early</li>
                </ul>
                
                <p>We look forward to your session!</p>
                <p>Best regards,<br>Interview Prep Platform Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Meeting reminder email sent to candidate:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending meeting reminder email to candidate:', error);
      throw error;
    }
  }

  /**
   * Send password email to admin-created users
   */
  async sendPasswordEmail(email, name, password, userType) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }
    
    try {
      console.log(`📧 Preparing to send password email to: ${email}`);
      
      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: email,
        subject: 'Your Account Credentials - Interview Prep Platform',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .credentials-box { background: white; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; border-radius: 5px; }
              .password-box { background: #f0f0f0; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #667eea; }
              .password-text { font-size: 20px; font-weight: bold; color: #667eea; font-family: monospace; letter-spacing: 2px; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Your Account Credentials</h1>
              </div>
              <div class="content">
                <p>Hello ${name},</p>
                <p>Your account has been created on the Interview Prep Platform by an administrator.</p>
                
                <div class="credentials-box">
                  <h3 style="margin-top: 0; color: #667eea;">Account Information:</h3>
                  <div style="margin: 10px 0;">
                    <strong>Email:</strong> ${email}
                  </div>
                  <div style="margin: 10px 0;">
                    <strong>User Type:</strong> ${userType === 'expert' ? 'Expert' : userType === 'admin' ? 'Administrator' : 'Candidate'}
                  </div>
                </div>
                
                <div class="password-box">
                  <p style="margin: 0 0 10px 0;"><strong>Your Temporary Password:</strong></p>
                  <div class="password-text">${password}</div>
                </div>
                
                <div class="warning">
                  <strong>⚠️ Important Security Notice:</strong>
                  <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>This is a temporary password generated by the system</li>
                    <li>You <strong>must change your password</strong> after your first login</li>
                    <li>Do not share this password with anyone</li>
                    <li>For security reasons, please log in and change your password immediately</li>
                  </ul>
                </div>
                
                <p><strong>Next Steps:</strong></p>
                <ol>
                  <li>Log in to your account using the email and password provided above</li>
                  <li>You will be prompted to change your password on first login</li>
                  <li>Choose a strong, unique password that you haven't used elsewhere</li>
                  <li>Complete your profile setup</li>
                </ol>
                
                <p>If you have any questions or need assistance, please contact our support team.</p>
                
                <p>Welcome to Interview Prep Platform!</p>
                <p>Best regards,<br>Interview Prep Platform Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>If you did not expect this email, please contact support immediately.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending password email:', error);
      throw error;
    }
  }

  /**
   * Send meeting reminder email to expert (1 hour before)
   */
  async sendMeetingReminderEmailToExpert(expertEmail, expertName, candidateName, session) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }
    
    try {
      console.log(`📧 Preparing to send reminder email to expert: ${expertEmail}`);
      const scheduledDate = new Date(session.scheduledDate);
      const formattedDate = scheduledDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = scheduledDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      const mailOptions = {
        from: 'testshubham6287@gmail.com',
        to: expertEmail,
        subject: `⏰ Reminder: Interview Session in 1 Hour - ${formattedDate}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .reminder-box { background: #fff3cd; border-left: 4px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 5px; }
              .meeting-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #667eea; }
              .detail-row { margin: 10px 0; }
              .detail-label { font-weight: bold; color: #667eea; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⏰ Interview Session Reminder</h1>
              </div>
              <div class="content">
                <div class="reminder-box">
                  <h2 style="margin-top: 0; color: #f57c00;">Your interview session starts in 1 hour!</h2>
                </div>
                
                <p>Hello ${expertName},</p>
                <p>This is a friendly reminder that you have an interview session scheduled to begin in <strong>1 hour</strong>.</p>
                
                <div class="meeting-details">
                  <h3>Meeting Details:</h3>
                  <div class="detail-row">
                    <span class="detail-label">Candidate:</span> ${candidateName}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Date:</span> ${formattedDate}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Time:</span> ${formattedTime}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span> ${session.duration} minutes
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Session Type:</span> ${session.sessionType || 'Technical Interview'}
                  </div>
                  ${session.title ? `<div class="detail-row"><span class="detail-label">Title:</span> ${session.title}</div>` : ''}
                </div>
                
                <p><strong>Please prepare:</strong></p>
                <ul>
                  <li>✅ Review your interview questions and materials</li>
                  <li>✅ Test your equipment (microphone, camera)</li>
                  <li>✅ Ensure a stable internet connection</li>
                  <li>✅ Be ready to join 5 minutes early</li>
                </ul>
                
                <p>Thank you for your commitment to helping candidates succeed!</p>
                <p>Best regards,<br>Interview Prep Platform Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Meeting reminder email sent to expert:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending meeting reminder email to expert:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();

