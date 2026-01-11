# Local Lens Neon Database Integration

This module provides centralized Neon database configuration and branch management for all Local Lens platforms, ensuring data isolation and scalability across services.

## Overview

The Local Lens system uses **Neon's database branching** feature to provide isolated database environments for each platform:

- **Main Branch**: Authentication and user management (`auth-service`)
- **Blood Branch**: Blood donation platform (`blood-platform`) 
- **Complaint Branch**: Complaint management platform (`complaint-platform`)
- **Traffic Branch**: Traffic management platform (`traffic-platform`)

## Features

- ✅ **Branch Isolation**: Each platform uses a separate Neon database branch
- ✅ **Automatic Connection Management**: Connection pooling with branch-specific URLs
- ✅ **Migration System**: Automated schema migrations per branch
- ✅ **Health Monitoring**: Connection health checks and monitoring
- ✅ **Comprehensive Testing**: Full test coverage for branch isolation
- ✅ **Transaction Support**: Safe transaction handling within branches

## Quick Start

### 1. Environment Setup

Copy the environment template and configure your Neon credentials:

```bash
cp .env.example .env
```

Update `.env` with your Neon database credentials:

```env
NEON_DATABASE_URL=postgresql://username:password@hostname:5432/database_name
NEON_PROJECT_ID=your-neon-project-id
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Migrations

Execute migrations for all branches:

```bash
npm run migrate
```

Or migrate a specific branch:

```bash
node migrate.js migrate --branch=main
```

### 4. Test Connection

Test all database connections:

```bash
npm run migrate:test
```

## Usage

### Basic Database Manager

```javascript
const { NeonDatabaseManager } = require('./neon-config');

// Initialize for specific branch
const dbManager = new NeonDatabaseManager('blood');
await dbManager.initialize();

// Execute queries
const result = await dbManager.query('SELECT * FROM donors WHERE blood_type = $1', ['O+']);

// Execute transactions
await dbManager.transaction([
  { text: 'INSERT INTO donors (name, email) VALUES ($1, $2)', params: ['John', 'john@example.com'] },
  { text: 'UPDATE donors SET availability = true WHERE email = $1', params: ['john@example.com'] }
]);

// Health check
const health = await dbManager.healthCheck();
console.log('Database healthy:', health.healthy);

// Close connection
await dbManager.close();
```

### Service Integration

Each service extends the base `NeonDatabaseManager`:

```javascript
// blood-platform/src/config/database.js
const { NeonDatabaseManager } = require('../../../shared/database/neon-config');

class DatabaseManager extends NeonDatabaseManager {
    constructor() {
        super('blood'); // Automatically connects to blood-donation branch
    }
    
    async createDonor(donorData) {
        const result = await this.query(
            'INSERT INTO donors (name, email, blood_type) VALUES ($1, $2, $3) RETURNING *',
            [donorData.name, donorData.email, donorData.blood_type]
        );
        return result.rows[0];
    }
}
```

## Migration System

### Available Commands

```bash
# Run all migrations
node migrate.js migrate

# Run migrations for specific branch
node migrate.js migrate --branch=main

# Show migration status
node migrate.js status

# Test database connections
node migrate.js test

# Dry run (show what would be executed)
node migrate.js migrate --dry-run

# Force re-run migrations
node migrate.js migrate --force
```

### Creating New Migrations

1. Create a new SQL file in `migrations/` directory:
   ```sql
   -- Migration: 006_new_feature_schema.sql
   -- Branch: blood-donation
   -- Description: Add new feature tables
   
   CREATE TABLE new_feature (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       name VARCHAR(100) NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. Update `MIGRATION_MAPPING` in `migrate.js`:
   ```javascript
   const MIGRATION_MAPPING = {
     'blood': ['002_blood_platform_schema.sql', '006_new_feature_schema.sql'],
     // ... other branches
   };
   ```

3. Run the migration:
   ```bash
   node migrate.js migrate --branch=blood
   ```

## Branch Configuration

### Available Branches

| Branch | Services | Description |
|--------|----------|-------------|
| `main` | `auth-service` | User authentication and management |
| `blood` | `blood-platform` | Blood donation and matching |
| `complaint` | `complaint-platform` | Complaint management and tracking |
| `traffic` | `traffic-platform` | Traffic signal management and AI |

### Branch Utilities

```javascript
const { BranchUtils } = require('./neon-config');

// Get all available branches
const branches = BranchUtils.getAllBranches();

// Check if branch is valid
const isValid = BranchUtils.isValidBranch('blood');

// Get services for a branch
const services = BranchUtils.getServicesForBranch('main');

// Get branch for a service
const branch = BranchUtils.getBranchForService('auth-service');
```

## Testing

### Comprehensive Test Suite

The system includes comprehensive tests that validate:

- **Branch Isolation**: Operations on one branch don't affect others
- **Connection Validation**: Each service connects to the correct branch
- **Transaction Isolation**: Transactions are isolated across branches
- **Concurrent Access**: Concurrent operations don't interfere

Run tests:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

### Test Requirements

Tests require actual Neon database credentials. Set up test environment:

```env
NEON_DATABASE_URL=postgresql://test_user:test_pass@test_host:5432/test_db
NEON_PROJECT_ID=test-project-id
```

## Architecture

### Connection String Format

Neon branch connections use the following format:

```
postgresql://username:password@hostname:port/neondb?options=project%3Dproject-id-branch-name
```

### Class Hierarchy

```
NeonDatabaseManager (base class)
├── AuthService DatabaseManager (main branch)
├── BloodPlatform DatabaseManager (blood branch)
├── ComplaintPlatform DatabaseManager (complaint branch)
└── TrafficPlatform DatabaseManager (traffic branch)
```

### Migration System

```
NeonMigrationManager
├── Migration tracking table per branch
├── Checksum validation
├── Rollback protection
└── Execution logging
```

## Production Deployment

### Environment Variables

Required for production:

```env
NODE_ENV=production
NEON_DATABASE_URL=postgresql://prod_user:secure_pass@prod_host:5432/prod_db
NEON_PROJECT_ID=production-project-id
```

### Security Considerations

- Use SSL connections in production (`ssl: { rejectUnauthorized: false }`)
- Rotate database credentials regularly
- Monitor connection pool usage
- Set up database connection alerts
- Use read replicas for analytics queries

### Monitoring

Health check endpoints are available for each service:

```javascript
const health = await dbManager.healthCheck();
// Returns: { healthy: true, branch: 'blood', timestamp: '...', connectionString: '...' }
```

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check Neon credentials and network connectivity
2. **Branch Not Found**: Verify branch exists in Neon console
3. **Migration Failed**: Check SQL syntax and dependencies
4. **Pool Exhausted**: Increase pool size or check for connection leaks

### Debug Mode

Enable verbose logging:

```env
VERBOSE_TESTS=true
DEBUG=neon:*
```

### Connection Pool Monitoring

```javascript
// Monitor pool status
console.log('Pool size:', dbManager.pool.totalCount);
console.log('Idle connections:', dbManager.pool.idleCount);
console.log('Waiting clients:', dbManager.pool.waitingCount);
```

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Test with actual Neon database before submitting
5. Ensure all tests pass

## License

MIT License - see LICENSE file for details.