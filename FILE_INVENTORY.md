# Complete File Inventory & Documentation

This document provides a comprehensive overview of all files in the InterviewAce project, explaining what each file does and why it's needed for AWS deployment.

---

## 📁 Root Directory Files

### Configuration Files

#### `package.json`
- **Purpose**: Root package.json for the frontend application
- **Why Needed**: Defines frontend dependencies, build scripts, and project metadata
- **AWS Deployment**: Required - contains build scripts (`npm run build`) and dependencies list
- **Key Scripts**: 
  - `dev`: Development server
  - `build`: Production build
  - `start`: Starts both frontend and backend servers

#### `package-lock.json`
- **Purpose**: Locks exact versions of all npm dependencies
- **Why Needed**: Ensures consistent dependency versions across environments
- **AWS Deployment**: Required - ensures production uses same dependency versions as development

#### `tsconfig.json`
- **Purpose**: TypeScript configuration for the frontend
- **Why Needed**: Defines TypeScript compiler options, paths, and type checking rules
- **AWS Deployment**: Required - needed for TypeScript compilation during build

#### `tsconfig.node.json`
- **Purpose**: TypeScript configuration for Node.js scripts (Vite config, etc.)
- **Why Needed**: Separate TypeScript settings for build tools vs application code
- **AWS Deployment**: Required - needed for building Vite configuration

#### `vite.config.ts`
- **Purpose**: Vite build tool configuration
- **Why Needed**: Configures the build process, aliases, plugins, and dev server settings
- **AWS Deployment**: Required - essential for building the production bundle
- **Key Features**: Path aliases (`@/` → `src/`), React plugin, build optimizations

#### `tailwind.config.js`
- **Purpose**: Tailwind CSS configuration
- **Why Needed**: Defines design system, colors, breakpoints, and custom utilities
- **AWS Deployment**: Required - needed to generate production CSS with Tailwind classes

#### `postcss.config.js`
- **Purpose**: PostCSS configuration (processes CSS)
- **Why Needed**: Processes Tailwind CSS and applies autoprefixer
- **AWS Deployment**: Required - needed for CSS processing during build

#### `index.html`
- **Purpose**: Main HTML entry point for the React application
- **Why Needed**: Template HTML that Vite injects the React app into
- **AWS Deployment**: Required - serves as the base HTML structure

---

### Application Entry Points

#### `start-robust-servers.js`
- **Purpose**: Script to start both frontend and backend servers simultaneously
- **Why Needed**: Convenient way to run the full stack locally
- **AWS Deployment**: **Not needed** - AWS will handle server startup differently (separate instances/services)
- **Note**: You may want to keep this for local development, but it's not used in AWS deployment

---

### Documentation

#### `README.md`
- **Purpose**: Project documentation and setup instructions
- **Why Needed**: Provides setup instructions, API documentation, and project overview
- **AWS Deployment**: Optional but recommended - helpful for team members and deployment reference

---

## 📁 Server Directory (`/server`)

### Main Server Files

#### `robust-server.js` ⭐ **PRIMARY SERVER**
- **Purpose**: Main production-ready Express.js server
- **Why Needed**: Handles all API endpoints, authentication, sessions, database operations
- **AWS Deployment**: **CRITICAL** - This is the main backend server
- **Features**:
  - Express.js application setup
  - CORS configuration
  - Authentication routes (`/api/auth/login`, `/api/auth/me`)
  - Session management (`/api/sessions`)
  - Expert directory (`/api/experts`)
  - Real-time updates (Server-Sent Events)
  - Database initialization
  - Graceful shutdown handling

#### `index.js`
- **Purpose**: Alternative/legacy server implementation
- **Why Needed**: Backup server implementation with different features
- **AWS Deployment**: **Optional** - Can be removed if `robust-server.js` is the only server used
- **Recommendation**: Remove if not being used

#### `setup-sqlite.js`
- **Purpose**: Script to configure SQLite database setup
- **Why Needed**: Helps configure Prisma to use SQLite instead of PostgreSQL
- **AWS Deployment**: **Optional** - Useful if you need to switch database providers, but not required if already configured

---

### Server Configuration

#### `config/server.js`
- **Purpose**: Server configuration settings (ports, CORS, etc.)
- **Why Needed**: Centralized configuration for server settings
- **AWS Deployment**: Required - contains port configuration and CORS settings
- **Key Settings**: Port detection, CORS origins, environment variables

#### `env.example`
- **Purpose**: Template for environment variables
- **Why Needed**: Documents all required environment variables
- **AWS Deployment**: **Recommended** - Use as reference when setting up AWS environment variables
- **Variables**: PORT, DATABASE_URL, JWT_SECRET, CORS origins, etc.

---

### Server Package Files

#### `package.json`
- **Purpose**: Backend dependencies and scripts
- **Why Needed**: Defines server dependencies (Express, Prisma, etc.) and npm scripts
- **AWS Deployment**: **CRITICAL** - Required for installing dependencies
- **Key Scripts**: `start`, `dev`, `seed`, `migrate`

#### `package-lock.json`
- **Purpose**: Locks backend dependency versions
- **Why Needed**: Ensures consistent server dependency versions
- **AWS Deployment**: Required - ensures production uses correct dependency versions

---

### Database Files (`/server/prisma`)

#### `schema.prisma`
- **Purpose**: Prisma database schema definition
- **Why Needed**: Defines all database models (User, Session, Review, Notification)
- **AWS Deployment**: **CRITICAL** - Required for database migrations and Prisma client generation
- **Contains**: User model, Session model, Review model, Notification model, and relationships

#### `dev.db`
- **Purpose**: SQLite database file (development)
- **Why Needed**: Local development database with test data
- **AWS Deployment**: **Should NOT be deployed** - Contains development data, should be in `.gitignore`
- **AWS Alternative**: Use AWS RDS (PostgreSQL/MySQL) or keep SQLite but initialize fresh on AWS

#### `migrations/20251012082248_init/migration.sql`
- **Purpose**: Initial database migration SQL
- **Why Needed**: Creates database tables and initial structure
- **AWS Deployment**: Required - Prisma uses this for database setup
- **Note**: Run `npx prisma migrate deploy` on AWS to apply migrations

#### `migrations/migration_lock.toml`
- **Purpose**: Locks the migration system to a specific database provider
- **Why Needed**: Prevents accidentally running migrations for wrong database type
- **AWS Deployment**: Required - ensures migrations target correct database

---

### Database & Services

#### `services/database.js` ⭐ **CRITICAL**
- **Purpose**: Database service layer - handles all database operations
- **Why Needed**: Centralized database access, user queries, session management
- **AWS Deployment**: **CRITICAL** - Core database functionality
- **Key Functions**:
  - `initialize()`: Database connection and seeding
  - `getUserByEmail()`: User lookup
  - `getSessionsForUser()`: Session queries
  - `createSession()`: Session creation
  - `seedDatabase()`: Initial data seeding

#### `services/realtime.js`
- **Purpose**: Real-time updates service (Server-Sent Events)
- **Why Needed**: Handles real-time notifications for session updates
- **AWS Deployment**: Required - enables real-time features
- **Features**: Connection management, event broadcasting, session notifications

#### `lib/prisma.js`
- **Purpose**: Prisma client initialization and export
- **Why Needed**: Singleton Prisma client instance for database access
- **AWS Deployment**: **CRITICAL** - Required for all database operations
- **Note**: Prisma client is auto-generated from `schema.prisma`

---

### Middleware (`/server/middleware`)

#### `auth.js`
- **Purpose**: Authentication middleware (legacy/token-based)
- **Why Needed**: JWT token validation and user authentication
- **AWS Deployment**: Required - protects authenticated routes
- **Functions**: Token verification, user authentication

#### `auth-prisma.js`
- **Purpose**: Prisma-based authentication middleware
- **Why Needed**: Database-backed authentication (alternative to `auth.js`)
- **AWS Deployment**: Required - used by robust-server for authentication

#### `validation.js`
- **Purpose**: Request validation middleware
- **Why Needed**: Validates incoming request data (email, passwords, etc.)
- **AWS Deployment**: Required - ensures data integrity and security

---

### Models (`/server/models`)

#### `User.js`, `Session.js`, `Review.js`, `Notification.js`
- **Purpose**: Mongoose/Mongoose-like models (legacy models)
- **Why Needed**: Alternative data models if not using Prisma
- **AWS Deployment**: **May not be needed** - If using Prisma exclusively, these can be removed
- **Status**: Check if `robust-server.js` uses these or only Prisma models

---

### Scripts (`/server/scripts`)

#### `migrate-database.js`
- **Purpose**: Database migration script
- **Why Needed**: Helps migrate between SQLite and PostgreSQL
- **AWS Deployment**: Optional - Useful for database migrations, but Prisma handles migrations

#### `seed.js`
- **Purpose**: Database seeding script
- **Why Needed**: Populates database with initial/test data
- **AWS Deployment**: **Useful** - Can seed production with initial admin users
- **Usage**: `npm run seed` in server directory

---

### Utilities

#### `utils/helpers.js`
- **Purpose**: Utility functions for the server
- **Why Needed**: Helper functions (date formatting, validation, etc.)
- **AWS Deployment**: Required - used by various server modules

---

### Directories

#### `uploads/`
- **Purpose**: Directory for uploaded files (profile pictures, resumes, etc.)
- **Why Needed**: Stores user-uploaded files locally
- **AWS Deployment**: **Should use S3 instead** - Local file storage doesn't scale on AWS
- **Recommendation**: Implement AWS S3 for file storage in production

---

## 📁 Frontend Source (`/src`)

### Entry Points

#### `main.tsx`
- **Purpose**: React application entry point
- **Why Needed**: Initializes React app and renders root component
- **AWS Deployment**: **CRITICAL** - Required entry point for React application

#### `app.tsx`
- **Purpose**: Root React component with routing
- **Why Needed**: Sets up React Router, AuthProvider, and all routes
- **AWS Deployment**: **CRITICAL** - Main application component
- **Contains**: All route definitions, authentication context, global providers

#### `index.css`
- **Purpose**: Global CSS styles and Tailwind directives
- **Why Needed**: Global styles, CSS variables, Tailwind imports
- **AWS Deployment**: Required - contains design system CSS variables

---

### Pages (`/src/pages`)

#### `Index.tsx`
- **Purpose**: Landing/home page
- **Why Needed**: Public-facing homepage with authentication options
- **AWS Deployment**: Required - Main entry point for users
- **Features**: Hero section, features, sign-in/sign-up options

#### `Dashboard.tsx`
- **Purpose**: Main dashboard page (for both candidates and experts)
- **Why Needed**: Central hub for users to manage sessions
- **AWS Deployment**: Required - Core user interface
- **Features**: Session list, user info, navigation

#### `ExpertDirectory.tsx`
- **Purpose**: Browse and search experts page
- **Why Needed**: Allows candidates to find and book experts
- **AWS Deployment**: Required - Core booking functionality

#### `ExpertProfile.tsx`
- **Purpose**: Individual expert profile page
- **Why Needed**: Shows expert details, availability, booking calendar
- **AWS Deployment**: Required - Expert booking interface

#### `NotFound.tsx`
- **Purpose**: 404 error page
- **Why Needed**: Handles invalid routes
- **AWS Deployment**: Required - User experience for invalid URLs

---

### Components (`/src/components`)

#### Core Components

##### `AuthModal.tsx`
- **Purpose**: Login and registration modal
- **Why Needed**: User authentication interface
- **AWS Deployment**: Required - Authentication UI

##### `ProtectedRoute.tsx`
- **Purpose**: Route protection component
- **Why Needed**: Restricts access to authenticated routes
- **AWS Deployment**: Required - Security and access control

##### `ConnectionStatus.tsx`
- **Purpose**: Shows backend connection status
- **Why Needed**: Visual indicator if backend is available
- **AWS Deployment**: Required - Helps diagnose connectivity issues

##### `CandidateDashboard.tsx`
- **Purpose**: Dashboard specific to candidates
- **Why Needed**: Candidate-specific session management UI
- **AWS Deployment**: Required - Candidate interface

##### `ExpertDashboard.tsx`
- **Purpose**: Dashboard specific to experts
- **Why Needed**: Expert-specific session management UI
- **AWS Deployment**: Required - Expert interface

##### `ExpertCard.tsx`
- **Purpose**: Card component for displaying expert in directory
- **Why Needed**: Reusable expert display component
- **AWS Deployment**: Required - Used in ExpertDirectory

##### `ExpertProfileEdit.tsx`
- **Purpose**: Expert profile editing form
- **Why Needed**: Allows experts to edit their profiles
- **AWS Deployment**: Required - Profile management

##### `BookingCalendar.tsx`
- **Purpose**: Calendar component for booking sessions
- **Why Needed**: Date/time selection for session booking
- **AWS Deployment**: Required - Booking functionality

##### `PaymentModal.tsx`
- **Purpose**: Payment processing modal
- **Why Needed**: Handles payment flow for session booking
- **AWS Deployment**: Required - Payment processing UI

##### `AvailabilityManager.tsx`
- **Purpose**: Expert availability management
- **Why Needed**: Allows experts to set available time slots
- **AWS Deployment**: Required - Availability management

##### `InteractiveCalendar.tsx`
- **Purpose**: Interactive calendar view
- **Why Needed**: Visual calendar for sessions and availability
- **AWS Deployment**: Required - Calendar UI

##### `ExpertAnalytics.tsx`
- **Purpose**: Analytics dashboard for experts
- **Why Needed**: Shows expert performance metrics
- **AWS Deployment**: Required - Analytics features

##### `ExpertCalendarDashboard.tsx`
- **Purpose**: Calendar view for expert dashboard
- **Why Needed**: Expert-specific calendar interface
- **AWS Deployment**: Required - Expert calendar view

##### `RegistrationForm.tsx`
- **Purpose**: User registration form
- **Why Needed**: New user sign-up interface
- **AWS Deployment**: Required - User registration

#### UI Components (`/src/components/ui`)

All Shadcn-UI components - pre-built, accessible React components:
- `alert.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `checkbox.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `separator.tsx`, `sonner.tsx`, `tabs.tsx`, `textarea.tsx`, `toast.tsx`, `tooltip.tsx`

- **Purpose**: Reusable UI component library
- **Why Needed**: Consistent, accessible UI components throughout the app
- **AWS Deployment**: **CRITICAL** - All UI components depend on these
- **Source**: Based on Radix UI primitives with Tailwind styling

---

### Contexts (`/src/contexts`)

#### `AuthContext.tsx` ⭐ **CRITICAL**
- **Purpose**: React Context for authentication state management
- **Why Needed**: Centralized auth state, user data, login/logout functions
- **AWS Deployment**: **CRITICAL** - Core authentication system
- **Features**: Token management, user state, auto-authentication on page load

---

### Hooks (`/src/hooks`)

#### `useIsMobile.ts`
- **Purpose**: React hook to detect mobile devices
- **Why Needed**: Responsive design logic
- **AWS Deployment**: Required - Responsive UI behavior

#### `useToast.ts`
- **Purpose**: Toast notification hook
- **Why Needed**: Display temporary notifications to users
- **AWS Deployment**: Required - User feedback system

---

### Libraries (`/src/lib`)

#### `apiService.ts` ⭐ **CRITICAL**
- **Purpose**: Frontend API client
- **Why Needed**: Handles all HTTP requests to backend
- **AWS Deployment**: **CRITICAL** - All backend communication
- **Features**: Request retry logic, error handling, token management, health checks

#### `auth.ts`
- **Purpose**: Frontend authentication service
- **Why Needed**: Local auth utilities, test users, localStorage management
- **AWS Deployment**: Required - Authentication utilities

#### `backendDetector.ts`
- **Purpose**: Detects backend server port
- **Why Needed**: Auto-discovers backend URL (local development)
- **AWS Deployment**: **May need modification** - Hardcode backend URL for AWS deployment

#### `realtimeService.ts`
- **Purpose**: Real-time updates client (Server-Sent Events)
- **Why Needed**: Receives real-time session updates
- **AWS Deployment**: Required - Real-time features

#### `sessionService.ts`
- **Purpose**: Session management service (local/mock)
- **Why Needed**: Fallback session storage for development
- **AWS Deployment**: Required - Session utilities (used as fallback)

#### `mockData.ts`
- **Purpose**: Mock data for development
- **Why Needed**: Test data when backend is unavailable
- **AWS Deployment**: **Optional** - Can be removed or kept for fallback

#### `utils.ts`
- **Purpose**: Frontend utility functions
- **Why Needed**: Helper functions (formatting, validation, etc.)
- **AWS Deployment**: Required - Used throughout frontend

---

## 📁 Build Output (`/dist`)

### `dist/`
- **Purpose**: Production build output (generated by Vite)
- **Why Needed**: Compiled, optimized frontend files ready for deployment
- **AWS Deployment**: **Should be regenerated on AWS** - Don't commit this folder
- **Contains**: Minified JavaScript, CSS, HTML
- **Generation**: Run `npm run build` to generate

---

## 🗑️ Files That Should NOT Be Deployed

### Development Files (Already Removed)
- ✅ Test files (`__tests__/`, `*.test.tsx`, `*.spec.ts`)
- ✅ Test configs (`jest.config.cjs`, `playwright.config.ts`)
- ✅ Development servers (`minimal-server.js`, `working-server.js`)
- ✅ Development scripts (`start-servers.bat`, `start-servers.ps1`)

### Should Be in .gitignore (Not Deployed)
- `node_modules/` - Regenerated with `npm install`
- `dist/` - Regenerated with `npm run build`
- `server/node_modules/` - Regenerated with `npm install` in server
- `server/prisma/dev.db` - Contains development data
- `.env` files - Contains secrets (use AWS environment variables instead)
- `server/uploads/` - Should use S3 in production

---

## 📋 AWS Deployment Checklist

### Required for Deployment:
1. ✅ All `/src` files (frontend source)
2. ✅ All `/server` files (except `dev.db` and `node_modules`)
3. ✅ Configuration files (`package.json`, `tsconfig.json`, `vite.config.ts`, etc.)
4. ✅ Prisma schema and migrations
5. ✅ Environment variable template (`env.example`)

### Should NOT Deploy:
1. ❌ `node_modules/` (install on server)
2. ❌ `dist/` (build on server or CI/CD)
3. ❌ `server/prisma/dev.db` (use fresh database)
4. ❌ `.env` files (use AWS environment variables)
5. ❌ Test files (already removed)
6. ❌ Development scripts (already removed)

### AWS-Specific Considerations:
1. **Database**: Use AWS RDS (PostgreSQL) instead of SQLite
2. **File Storage**: Use AWS S3 instead of `server/uploads/`
3. **Environment Variables**: Set in AWS (Elastic Beanstalk, ECS, or Lambda)
4. **Build Process**: Run `npm run build` in CI/CD or on EC2 instance
5. **Backend URL**: Update `backendDetector.ts` or set `API_BASE_URL` in environment

---

## 🚀 Deployment Steps Summary

1. **Frontend Build**: `npm run build` → Creates `dist/` folder
2. **Backend Setup**: Install dependencies in `server/` directory
3. **Database**: Run Prisma migrations on AWS database
4. **Environment**: Configure AWS environment variables
5. **Deploy**: Upload to AWS (S3 + CloudFront for frontend, EC2/ECS/EB for backend)

---

**Last Updated**: After cleanup for AWS deployment
**Total Files**: ~150+ source files (excluding node_modules and build artifacts)

