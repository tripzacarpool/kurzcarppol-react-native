# RaahEasy Backend API - Optimized Architecture

Production-ready backend with clean separation of concerns: routes, controllers, middleware, and config.

## Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration
│   │   ├── database.js      # MongoDB connection
│   │   └── models.js        # Mongoose schemas
│   ├── controllers/         # Business Logic
│   │   ├── userController.js
│   │   └── healthController.js
│   ├── routes/              # API Routes
│   │   ├── userRoutes.js
│   │   └── healthRoutes.js
│   ├── middleware/          # Middleware
│   │   └── errorHandler.js
│   └── server.js            # Express app
├── .env                     # Environment variables
└── package.json
```

## Quick Start

```bash
npm install
npm run dev         # Development with hot-reload
npm start          # Production
```

## API Endpoints

**POST** `/api/users/sync` - Sync user from Clerk  
**GET** `/api/users/:clerkId` - Get user profile  
**PATCH** `/api/users/:clerkId/role` - Update user role  
**GET** `/health` - Health check

### Install Dependencies

```bash
cd backend
npm install
```

### Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Run Production Server

```bash
npm start
```

## API Endpoints

### Health Check

- **GET** `/health` - Check if backend is running

### User Sync

- **POST** `/api/users/sync` - Sync user data from Clerk to MongoDB

**Request body:**

```json
{
  "clerkId": "user_123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "profileImage": "https://..."
}
```

**Response:**

```json
{
  "id": "mongodb_id",
  "clerkId": "user_123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "passenger"
}
```

## Environment Variables

Create a `.env` file with:

```
MONGODB_URI=mongodb+srv://...
MONGODB_DB=kruzapp
PORT=3000
```

## Project Structure

```
backend/
├── server.js          # Express server entry point
├── package.json       # Dependencies
├── .env              # Environment variables
└── lib/
    ├── mongodb.ts    # MongoDB connection
    └── models.ts     # Mongoose schemas
```
