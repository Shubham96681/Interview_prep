const prisma = require('../lib/prisma');
const emailService = require('./emailService');

class ReminderService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
    this.sentReminders = new Set(); // Track sent reminders to avoid duplicates
  }

  /**
   * Start the reminder service
   * Checks for upcoming sessions every 5 minutes
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Reminder service is already running');
      return;
    }

    console.log('✅ Starting reminder service...');
    this.isRunning = true;

    // Run immediately on start
    this.checkAndSendReminders();

    // Then check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkAndSendReminders();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    console.log('✅ Reminder service started. Checking for upcoming sessions every 5 minutes.');
  }

  /**
   * Stop the reminder service
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Reminder service stopped');
  }

  /**
   * Check for sessions starting in 1 hour and send reminders
   */
  async checkAndSendReminders() {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      
      // Find sessions that start between 55 minutes and 65 minutes from now
      // This gives us a 10-minute window to catch sessions
      const startWindow = new Date(now.getTime() + 55 * 60 * 1000); // 55 minutes
      const endWindow = new Date(now.getTime() + 65 * 60 * 1000); // 65 minutes

      console.log(`🔍 Checking for sessions between ${startWindow.toISOString()} and ${endWindow.toISOString()}`);

      const upcomingSessions = await prisma.session.findMany({
        where: {
          scheduledDate: {
            gte: startWindow,
            lte: endWindow
          },
          status: {
            in: ['scheduled', 'rescheduled'] // Only send reminders for scheduled/rescheduled sessions
          }
        },
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          expert: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      console.log(`📋 Found ${upcomingSessions.length} upcoming sessions`);

      for (const session of upcomingSessions) {
        // Create a unique key for this reminder
        const reminderKey = `${session.id}-reminder-sent`;

        // Skip if we've already sent a reminder for this session
        if (this.sentReminders.has(reminderKey)) {
          console.log(`⏭️ Reminder already sent for session ${session.id}, skipping...`);
          continue;
        }

        // Check if session is approximately 1 hour away (within 5 minutes tolerance)
        const timeUntilSession = new Date(session.scheduledDate).getTime() - now.getTime();
        const minutesUntilSession = timeUntilSession / (1000 * 60);

        if (minutesUntilSession >= 55 && minutesUntilSession <= 65) {
          console.log(`📧 Sending reminder emails for session ${session.id} (${minutesUntilSession.toFixed(1)} minutes away)`);

          try {
            // Send reminder emails to both candidate and expert
            const emailResults = await Promise.allSettled([
              emailService.sendMeetingReminderEmailToCandidate(
                session.candidate.email,
                session.candidate.name,
                session.expert.name,
                session
              ),
              emailService.sendMeetingReminderEmailToExpert(
                session.expert.email,
                session.expert.name,
                session.candidate.name,
                session
              )
            ]);

            // Check results
            let allSucceeded = true;
            emailResults.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                console.log(`✅ Reminder email ${index === 0 ? 'to candidate' : 'to expert'} sent successfully:`, result.value.messageId);
              } else {
                console.error(`❌ Failed to send reminder email ${index === 0 ? 'to candidate' : 'to expert'}:`, result.reason);
                allSucceeded = false;
              }
            });

            // Mark reminder as sent only if at least one email succeeded
            if (allSucceeded || emailResults.some(r => r.status === 'fulfilled')) {
              this.sentReminders.add(reminderKey);
              console.log(`✅ Reminder sent for session ${session.id}`);
            }
          } catch (error) {
            console.error(`❌ Error sending reminder emails for session ${session.id}:`, error);
          }
        }
      }

      // Clean up old reminder keys (older than 2 hours) to prevent memory buildup
      // This is a simple cleanup - in production, you might want to use a more sophisticated approach
      if (this.sentReminders.size > 1000) {
        console.log('🧹 Cleaning up old reminder keys...');
        // Keep only the most recent 500 entries
        const entries = Array.from(this.sentReminders);
        this.sentReminders = new Set(entries.slice(-500));
      }
    } catch (error) {
      console.error('❌ Error checking for reminders:', error);
      console.error('❌ Error stack:', error.stack);
    }
  }
}

module.exports = new ReminderService();

