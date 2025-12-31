# Local Lens Complaint Management Platform

Government complaint filing, tracking, and resolution system with multi-authority coordination.

## Features

- Citizen complaint filing
- Automatic category assignment
- Authority routing and assignment
- Real-time status tracking
- Priority-based escalation
- Geolocation mapping
- File attachment support
- Analytics dashboard

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

### Complaints
- `POST /api/complaints` - File new complaint
- `GET /api/complaints` - Get complaints list
- `GET /api/complaints/:id` - Get complaint details
- `PUT /api/complaints/:id/status` - Update complaint status

### Authorities
- `GET /api/authorities` - Get authorities list
- `POST /api/authorities/:id/assign` - Assign complaint to authority

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard metrics
- `GET /api/analytics/reports` - Generate reports

## Complaint Categories

- Water supply issues
- Electricity problems
- Municipal services
- Transportation
- Public safety
- Environmental concerns

## Docker

```bash
# Build and run with dependencies
docker-compose up -d
```