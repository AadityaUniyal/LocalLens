# Local Lens Blood Donation Platform

Real-time blood donor-recipient matching with emergency response capabilities.

## Features

- Donor and recipient registration
- Real-time blood matching engine
- Location-based proximity matching
- Blood inventory management
- Emergency alert system
- Socket.io real-time notifications
- Blood bank integration
- Hospital coordination

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

### Donors
- `POST /api/donors/register` - Register as donor
- `GET /api/donors/profile` - Get donor profile
- `PUT /api/donors/availability` - Update availability

### Recipients
- `POST /api/recipients/request` - Create blood request
- `GET /api/recipients/requests` - Get recipient requests

### Matching
- `GET /api/matching/find` - Find compatible donors
- `POST /api/matching/notify` - Send match notifications

## Real-time Events

- `blood_request_created` - New blood request
- `donor_matched` - Donor found for recipient
- `emergency_alert` - Critical blood need

## Docker

```bash
# Build and run with dependencies
docker-compose up -d
```