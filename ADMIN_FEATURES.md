# Admin Dashboard Features

## Overview
The admin dashboard provides comprehensive management capabilities for the InterviewAce platform. Admins can manage all users, sessions, reviews, and system analytics.

## Admin Login Credentials
- **Email**: `admin@interviewace.com`
- **Password**: `hashed_password_123` (or any password - currently accepts any password for demo purposes)

## Features

### 1. Overview Dashboard
- **Total Users**: View total and active user counts
- **Total Sessions**: View total session count
- **Total Reviews**: View total reviews and average rating
- **User Types**: Breakdown of candidates, experts, and admins
- **Sessions by Status**: Distribution of sessions by status (scheduled, in_progress, completed, cancelled, rescheduled)
- **Users by Type**: Distribution of users by type

### 2. Sessions Management
- **View All Sessions**: See all interview sessions in the system
- **Edit Sessions**: Update session details including:
  - Date and time
  - Duration
  - Session type
  - Status
  - Payment amount and status
- **Delete Sessions**: Remove sessions from the system
- **Filter and Search**: View sessions by various criteria

### 3. Users Management
- **View All Users**: See all registered users (candidates, experts, admins)
- **Edit Users**: Update user details including:
  - Name and email
  - User type (candidate, expert, admin)
  - Active/Inactive status
  - Verification status (for experts)
- **User Statistics**: View user ratings, total sessions, and other metrics

### 4. Reviews & Feedback
- **View All Reviews**: See all feedback and reviews submitted by users
- **Review Details**: View complete review information including:
  - Rating (1-5 stars)
  - Comments
  - Reviewer and reviewee information
  - Associated session details
  - Timestamp

### 5. Participant Management
- **Add Participants**: Add additional participants to interview sessions
- **View Current Participants**: See all participants in a session (candidate, expert, and additional participants)
- **Manage Participants**: Add or remove participants from sessions

## API Endpoints

All admin endpoints require admin authentication and are prefixed with `/api/admin/`:

- `GET /api/admin/sessions` - Get all sessions
- `PUT /api/admin/sessions/:id` - Update a session
- `DELETE /api/admin/sessions/:id` - Delete a session
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id` - Update a user
- `GET /api/admin/reviews` - Get all reviews
- `PUT /api/admin/sessions/:id/participants` - Add participants to a session
- `GET /api/admin/analytics` - Get system analytics

## Database Schema Updates

### User Model
- Added `admin` to the `UserType` enum

### Session Model
- Added `additionalParticipants` field (JSON string) to store additional participant user IDs

## Access Control

Admin access is controlled by:
1. User must have `userType: 'admin'` in the database
2. Admin endpoints check for admin role before allowing access
3. Frontend shows AdminDashboard component only for admin users

## Usage

1. **Login as Admin**: Use the admin credentials to log in
2. **Access Dashboard**: Navigate to `/dashboard` - you'll see the Admin Dashboard
3. **Manage Content**: Use the tabs to navigate between different management sections
4. **Make Changes**: Edit, delete, or add content as needed

## Notes

- Admin authentication currently uses email-based checking (for demo purposes)
- In production, implement proper JWT token verification
- All admin actions are logged and can be audited
- Admin users have full system access - use with caution

