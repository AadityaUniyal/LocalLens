# Local Lens Authentication Service

Centralized authentication service for the Local Lens multi-platform system.

## Features

- JWT-based authentication
- Role-based access control
- Session management
- Password hashing with bcrypt
- Redis session storage
- PostgreSQL user storage

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm test
```

## API Endpoints

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile
- `POST /auth/refresh-token` - Refresh JWT token

## Environment Variables

See `.env.example` for required environment variables.

## Docker

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```