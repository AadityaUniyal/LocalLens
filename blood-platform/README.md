# Blood Donation Platform 🩸

A comprehensive real-time blood donation and emergency matching platform built with Node.js, Express, PostgreSQL (Neon), and Socket.IO. Part of the Local Lens civic technology ecosystem.

## Features

### Core Functionality
- **Donor Registration & Management**: Complete donor profiles with medical history and availability tracking
- **Blood Request System**: Emergency and routine blood requests with urgency levels
- **Smart Matching Engine**: AI-powered donor-recipient matching based on blood type compatibility, location, and availability
- **Real-time Notifications**: WebSocket-based live updates for critical requests and matches
- **Blood Bank Integration**: Inventory management and stock level monitoring
- **Emergency Response System**: Automated escalation for critical blood requests

### Advanced Features
- **Analytics Dashboard**: Comprehensive reporting on donations, requests, and platform performance
- **Geographic Matching**: Location-based donor search with configurable radius
- **Inventory Management**: Blood bank stock tracking with expiration monitoring
- **Multi-channel Notifications**: Email, SMS, and push notifications for emergency alerts
- **Role-based Access Control**: Different access levels for donors, hospitals, and administrators
- **API Documentation**: Complete OpenAPI/Swagger documentation

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Neon with branch isolation)
- **Real-time**: Socket.IO for WebSocket connections
- **Authentication**: JWT-based authentication with role management
- **Validation**: Express-validator with custom blood platform rules
- **Testing**: Jest with Supertest for integration testing
- **Logging**: Winston for structured logging
- **Containerization**: Docker with multi-stage builds

## Quick Start

### Prerequisites
- Node.js 18+ 
- Docker (optional, for containerized deployment)
- PostgreSQL database (Neon recommended)

### Installation

1. **Clone and navigate to the blood platform**:
   ```bash
   cd blood-platform
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**:
   ```bash
   # Apply the blood platform schema
   psql $NEON_BLOOD_DATABASE_URL -f ../shared/database/migrations/002_blood_platform_schema.sql
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

The platform will be available at `http://localhost:3002`

### Docker Deployment

For production deployment using Docker:

```bash
# Build and deploy (Linux/Mac)
./scripts/deploy.sh

# Build and deploy (Windows)
.\scripts\deploy.ps1

# Development deployment (skip tests)
.\scripts\deploy.ps1 -Dev
```

## API Documentation

### Base URL
```
http://localhost:3002
```

### Authentication
Include JWT token in requests:
```
Authorization: Bearer <jwt-token>
```

### Key Endpoints

#### Health Check
```http
GET /health
```

#### Donor Management
```http
POST /api/donors/register          # Register new donor
GET /api/donors/profile/:donorId   # Get donor profile
PUT /api/donors/:donorId/availability  # Update availability
GET /api/donors/:donorId/statistics    # Get donor statistics
```

#### Blood Requests
```http
POST /api/requests                 # Create blood request
GET /api/requests                  # Get requests (with filters)
GET /api/requests/:requestId       # Get specific request
PUT /api/requests/:requestId/status # Update request status
```

#### Matching & Donations
```http
POST /api/matching/find-donors     # Find compatible donors
POST /api/matching/confirm         # Confirm donation match
```

#### Analytics
```http
GET /api/analytics/dashboard       # Dashboard analytics
GET /api/analytics/blood-type-distribution  # Blood type analytics
GET /api/analytics/inventory       # Inventory analytics
GET /api/analytics/performance     # Performance metrics
```

For complete API documentation, visit `/api/docs` when the server is running.

## Database Schema

The platform uses a comprehensive PostgreSQL schema with the following key tables:

- **donors**: Donor profiles and availability
- **blood_requests**: Blood requests with urgency levels
- **donations**: Donation records and scheduling
- **blood_banks**: Blood bank information and locations
- **blood_inventory**: Stock levels and expiration tracking
- **donor_matches**: Matching algorithm results
- **emergency_notifications**: Emergency alert system

## Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Server
PORT=3002
NODE_ENV=production

# Database
NEON_BLOOD_DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET=your-secret-key

# Emergency Settings
EMERGENCY_RESPONSE_TIME_MINUTES=30
EMERGENCY_SEARCH_RADIUS_KM=200

# Notifications
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=true
```

### Blood Type Compatibility

The platform implements the standard ABO/Rh blood type compatibility matrix:

- **O-**: Universal donor (can donate to all types)
- **AB+**: Universal recipient (can receive from all types)
- **A+**: Can donate to A+, AB+
- **A-**: Can donate to A+, A-, AB+, AB-
- And so on...

## Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration
```

### Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: API endpoint testing
- **Compatibility Tests**: Blood type compatibility validation
- **Performance Tests**: Load and stress testing

## Monitoring & Analytics

### Health Monitoring
- Service health checks at `/health`
- Database connectivity monitoring
- Real-time performance metrics

### Analytics Features
- Donor registration trends
- Blood request patterns
- Matching success rates
- Geographic distribution analysis
- Inventory turnover rates

### Logging
Structured logging with Winston:
- Request/response logging
- Error tracking and alerting
- Performance monitoring
- Security event logging

## Emergency Response System

### Critical Request Handling
1. **Immediate Matching**: Find all compatible donors within emergency radius
2. **Multi-channel Alerts**: Send SMS, email, and push notifications
3. **Escalation**: Automatic escalation if no response within 30 minutes
4. **Blood Bank Alerts**: Notify nearby blood banks for inventory checks

### Emergency Thresholds
- **Critical Response Time**: 30 minutes
- **Emergency Search Radius**: 200km
- **Minimum Donors Required**: 3 before escalation
- **Escalation Time**: 60 minutes with no response

## Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Platform-specific access permissions
- Session management and token refresh

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection with Helmet.js
- Rate limiting for API endpoints
- CORS configuration

### Privacy Compliance
- Data anonymization for analytics
- Consent management for notifications
- Secure data transmission (HTTPS)
- Audit logging for sensitive operations

## Performance Optimization

### Database Optimization
- Indexed queries for fast lookups
- Connection pooling with pg-pool
- Query optimization for matching algorithms
- Efficient geographic queries

### Caching Strategy
- Redis caching for frequently accessed data
- Analytics result caching
- Session storage optimization

### Real-time Performance
- WebSocket connection management
- Efficient event broadcasting
- Connection pooling and cleanup

## Deployment

### Production Deployment
1. **Environment Setup**: Configure production environment variables
2. **Database Migration**: Apply schema and seed data
3. **Docker Build**: Create production Docker image
4. **Container Deployment**: Deploy with proper resource limits
5. **Health Checks**: Verify all services are operational
6. **Monitoring Setup**: Configure logging and alerting

### Scaling Considerations
- Horizontal scaling with load balancers
- Database read replicas for analytics
- Redis clustering for session management
- CDN for static assets

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards
- ESLint configuration for code quality
- Prettier for code formatting
- JSDoc comments for functions
- Comprehensive test coverage

### Testing Requirements
- Unit tests for all new functions
- Integration tests for API endpoints
- Compatibility tests for business logic
- Performance tests for critical paths

## Troubleshooting

### Common Issues

**Database Connection Errors**:
- Verify NEON_BLOOD_DATABASE_URL is correct
- Check network connectivity
- Ensure database branch exists

**WebSocket Connection Issues**:
- Check CORS configuration
- Verify Socket.IO client version compatibility
- Review firewall settings

**Performance Issues**:
- Monitor database query performance
- Check connection pool settings
- Review memory usage and garbage collection

### Debug Mode
Enable debug logging:
```bash
DEBUG=blood-platform:* npm run dev
```

### Health Checks
Monitor service health:
```bash
curl http://localhost:3002/health
```

## License

This project is part of the Local Lens ecosystem and is licensed under the MIT License.

## Support

For support and questions:
- Check the API documentation at `/api/docs`
- Review the troubleshooting section
- Check service health at `/health`
- Review application logs for error details

## Roadmap

### Upcoming Features
- [ ] Mobile app integration
- [ ] Advanced ML-based matching
- [ ] Integration with hospital systems
- [ ] Blockchain-based donation tracking
- [ ] Multi-language support
- [ ] Advanced analytics with ML insights

### Performance Improvements
- [ ] GraphQL API implementation
- [ ] Advanced caching strategies
- [ ] Database query optimization
- [ ] Real-time analytics dashboard

---

**Built with ❤️ for saving lives through technology**