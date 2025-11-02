-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "title" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bio" TEXT,
    "experience" TEXT,
    "skills" TEXT,
    "rating" REAL NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "hourlyRate" REAL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "yearsOfExperience" TEXT,
    "proficiency" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "workingHoursStart" TEXT DEFAULT '09:00',
    "workingHoursEnd" TEXT DEFAULT '17:00',
    "daysAvailable" TEXT,
    "resumePath" TEXT,
    "profilePhotoPath" TEXT,
    "certificationPaths" TEXT
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledDate" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "sessionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "candidateId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "paymentAmount" REAL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "feedbackRating" INTEGER,
    "feedbackComment" TEXT,
    "feedbackDate" DATETIME,
    CONSTRAINT "sessions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sessions_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "categories" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    CONSTRAINT "reviews_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
