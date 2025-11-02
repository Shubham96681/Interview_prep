# Interview Marketplace

A comprehensive interview marketplace platform that connects candidates with expert interview coaches. Built with modern technologies for both frontend and backend.

## Technology Stack

### Frontend
- **Vite** - Fast build tool and development server
- **TypeScript** - Type-safe JavaScript
- **React** - Modern UI library
- **Shadcn-UI** - Beautiful, accessible component library
- **Tailwind CSS** - Utility-first CSS framework

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Tokens for authentication
- **Multer** - File upload handling
- **Express Validator** - Input validation

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   └── ...
│   └── package.json
├── server/                 # Backend Node.js application
│   ├── models/            # Database models
│   │   ├── User.js
│   │   ├── Session.js
│   │   ├── Review.js
│   │   └── Notification.js
│   ├── middleware/        # Express middleware
│   │   ├── auth.js
│   │   └── validation.js
│   ├── utils/            # Utility functions
│   │   └── helpers.js
│   ├── scripts/          # Database scripts
│   │   └── seed.js
│   ├── uploads/          # File upload directory
│   ├── index.js          # Main server file
│   ├── package.json
│   └── env.example       # Environment variables template
├── src/                   # Main frontend (Shadcn-UI)
│   ├── components/
│   │   └── ui/           # Shadcn-UI components
│   ├── pages/            # Page components
│   ├── lib/              # Utility functions
│   └── ...
├── package.json          # Root package.json
└── README.md
```

## Components

All Shadcn-UI components are pre-downloaded and available at `@/components/ui`:

- **Button** - Various button styles and sizes
- **Card** - Content containers with header, content, and footer
- **Badge** - Small status indicators
- **Separator** - Visual dividers

## Styling

- Add global styles to `src/index.css` or create new CSS files as needed
- Use Tailwind classes for styling components
- Custom design tokens are configured in `tailwind.config.js`
- Dark mode support is included

## Features

### Frontend Features
- **Modern UI** - Built with Shadcn-UI components and Tailwind CSS
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark Mode Support** - Toggle between light and dark themes
- **Expert Directory** - Browse and search for interview experts
- **Session Booking** - Book mock interviews and coaching sessions
- **User Profiles** - Manage personal information and preferences
- **Real-time Notifications** - Stay updated with session updates

### Backend Features
- **User Authentication** - JWT-based authentication system
- **Role-based Access** - Separate flows for candidates and experts
- **Session Management** - Complete booking and scheduling system
- **Review System** - Rate and review completed sessions
- **File Upload** - Profile pictures and document uploads
- **Notification System** - Real-time notifications for users
- **Payment Integration** - Ready for payment gateway integration
- **Data Validation** - Comprehensive input validation
- **Error Handling** - Robust error handling and logging

## Development

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- pnpm (recommended) or npm

### Installation

#### Frontend Setup
```bash
# Install frontend dependencies
pnpm install

# Or with npm
npm install
```

#### Backend Setup
```bash
# Navigate to server directory
cd server

# Install backend dependencies
npm install

# Copy environment variables
cp env.example .env

# Edit .env file with your configuration
# Set MONGODB_URI, JWT_SECRET, etc.
```

### Database Setup

```bash
# Start MongoDB (if running locally)
mongod

# Seed the database with sample data
cd server
npm run seed
```

### Available Scripts

#### Frontend Scripts
```bash
# Start development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Run linting
pnpm run lint
```

#### Backend Scripts
```bash
# Start development server
cd server
npm run dev

# Start production server
npm start

# Seed database
npm run seed

# Run tests
npm test
```

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### API Endpoints

#### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user profile

#### Users & Experts
- `GET /experts` - Get all experts (with pagination and filters)
- `GET /experts/:id` - Get expert by ID
- `PUT /profile` - Update user profile
- `POST /profile/picture` - Upload profile picture

#### Sessions
- `POST /sessions` - Book a new session
- `GET /sessions` - Get user's sessions
- `GET /sessions/:id` - Get session by ID
- `PUT /sessions/:id/status` - Update session status

#### Reviews
- `POST /reviews` - Create a review
- `GET /reviews/user/:userId` - Get reviews for a user

#### Notifications
- `GET /notifications` - Get user notifications
- `PUT /notifications/:id/read` - Mark notification as read
- `PUT /notifications/read-all` - Mark all notifications as read

### Sample API Calls

#### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "candidate"
  }'
```

#### Book Session
```bash
curl -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "expertId": "expert_id_here",
    "title": "Mock Technical Interview",
    "description": "Practice for upcoming interview",
    "scheduledDate": "2024-01-15T10:00:00Z",
    "duration": 60,
    "sessionType": "mock-interview"
  }'
```

### Usage

Import components from `@/components/ui` in your React components:

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello World</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click me</Button>
        <Badge variant="secondary">New</Badge>
      </CardContent>
    </Card>
  )
}
```

## Path Aliases

The `@/` path alias points to the `src/` directory, configured in:
- `vite.config.ts` - For build tool
- `tsconfig.json` - For TypeScript

## Customization

- **Colors**: Modify CSS variables in `src/index.css`
- **Components**: Customize Shadcn-UI components in `src/components/ui/`
- **Styling**: Update `tailwind.config.js` for custom design tokens
- **Theme**: Toggle between light and dark modes

## Adding More Components

To add more Shadcn-UI components:

1. Install the required Radix UI primitives
2. Copy the component code from [shadcn/ui](https://ui.shadcn.com/)
3. Place it in `src/components/ui/`
4. Import and use in your components

## Notes

- The `@/` path alias points to the `src/` directory
- In your TypeScript code, don't re-export types that you're already importing
- All components are fully typed and accessible
- Dark mode is supported out of the box

## Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/interview-marketplace

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

## Database Models

### User Model
- **Basic Info**: name, email, password, role
- **Profile**: bio, experience, skills, rating, hourlyRate
- **Availability**: timezone, working hours, available days
- **Verification**: isVerified, verification documents

### Session Model
- **Participants**: candidate, expert
- **Details**: title, description, scheduledDate, duration
- **Status**: pending, confirmed, in-progress, completed, cancelled
- **Payment**: price, paymentStatus, paymentId
- **Feedback**: notes, ratings, comments

### Review Model
- **Review Info**: session, reviewer, reviewee, rating, comment
- **Categories**: professionalism, communication, expertise, punctuality
- **Metadata**: isVerified, isPublic, helpfulVotes

### Notification Model
- **Content**: user, type, title, message, data
- **Status**: isRead, priority, expiresAt

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - Bcrypt for secure password storage
- **Input Validation** - Comprehensive validation using express-validator
- **CORS Protection** - Configurable CORS settings
- **File Upload Security** - File type and size validation
- **Rate Limiting** - Protection against abuse (ready for implementation)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Interview_product
   ```

2. **Setup Backend**
   ```bash
   cd server
   npm install
   cp env.example .env
   # Edit .env with your configuration
   npm run seed  # Optional: seed with sample data
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   # In the root directory
   pnpm install
   pnpm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/api/health

5. **Test with Sample Data**
   - Use the seeded accounts to test the platform
   - Candidate: john@example.com / password123
   - Expert: jane@example.com / password123

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

Happy coding! 🚀