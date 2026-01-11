# Neon Database Setup Guide for Local Lens

This guide will help you set up a Neon project with schema-based separation for each Local Lens platform.

## Prerequisites

1. **Neon Account**: Sign up at [neon.tech](https://neon.tech)
2. **Neon CLI** (optional but recommended): Install via `npm install -g neonctl`

## Step 1: Create New Neon Project

### Via Neon Console (Web Interface)

1. **Login to Neon Console**
   - Go to [console.neon.tech](https://console.neon.tech)
   - Sign in with your account

2. **Create New Project**
   - Click "New Project"
   - Project Name: `local-lens-system`
   - Database Name: `local_lens_db`
   - Region: Choose closest to your location
   - PostgreSQL Version: 15 (recommended)

3. **Save Connection Details**
   - Copy the connection string from the dashboard
   - Note down the Project ID

### Via Neon CLI (Alternative)

```bash
# Install Neon CLI
npm install -g neonctl

# Login to Neon
neonctl auth

# Create new project
neonctl projects create --name "local-lens-system" --database-name "local_lens_db"
```

## Step 2: Schema-Based Architecture

### Schema Structure

The system uses a single Neon branch with separate PostgreSQL schemas for platform isolation:

| Schema Name | Purpose | Service |
|-------------|---------|---------|
| `auth` | Authentication & Users | auth-service |
| `blood` | Blood Platform | blood-platform |
| `complaint` | Complaint Platform | complaint-platform |
| `traffic` | Traffic Platform | traffic-platform |

### Benefits of Schema-Based Approach

- **Single Connection**: One Neon branch reduces complexity
- **Data Isolation**: PostgreSQL schemas provide logical separation
- **Cost Effective**: No need for multiple branches
- **Easier Management**: Single connection string to manage
- **Better Performance**: No connection timeout issues from multiple branches

## Step 3: Get Connection String

### From Neon Console
- Go to your project dashboard
- Click "Connect" to see the connection string
- Copy the main branch connection string

### From CLI
```bash
# Get connection string for main branch
neonctl connection-string --project-id $NEON_PROJECT_ID --branch main
```

## Step 4: Configure Environment Variables

Create a `.env` file in your project root:

```env
# Neon Database Configuration for Local Lens
# Single branch with schema-based separation

# Neon Project Configuration
NEON_PROJECT_ID=your-project-id-here
NEON_DATABASE_URL=postgresql://username:password@hostname:5432/neondb?sslmode=require&channel_binding=require

# Environment
NODE_ENV=development

# Testing Configuration
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/test_db
VERBOSE_TESTS=false
```

## Step 5: Run Database Migrations

The system will automatically create schemas for each service when they initialize.

```bash
# Navigate to shared database directory
cd shared/database

# Install dependencies
npm install

# Test connection
node -e "
const { NeonDatabaseManager } = require('./neon-config');
require('dotenv').config({ path: '../../.env' });

async function test() {
  const manager = new NeonDatabaseManager('auth-service');
  await manager.initialize();
  console.log('✅ Connection successful');
  await manager.close();
}
test().catch(console.error);
"

# Run migrations for all services
npm run migrate
```

## Step 6: Verify Setup

### Test Schema Creation

Each service will automatically create its schema when it starts:

```bash
# Test auth service
cd auth-service
npm start

# Test blood platform
cd blood-platform
npm start

# Test complaint platform
cd complaint-platform
npm start
```

### Verify Schema Isolation

```bash
# Run comprehensive tests
cd shared/database
npm test
```

## Step 7: Service Configuration

Each service is automatically configured to use the correct schema:

### Auth Service
```javascript
// auth-service/src/config/database.js
const manager = new NeonDatabaseManager('auth-service'); // Uses 'auth' schema
```

### Blood Platform
```javascript
// blood-platform/src/config/database.js
const manager = new NeonDatabaseManager('blood-platform'); // Uses 'blood' schema
```

### Complaint Platform
```javascript
// complaint-platform/src/config/database.js
const manager = new NeonDatabaseManager('complaint-platform'); // Uses 'complaint' schema
```

### Traffic Platform
```python
# traffic-platform/src/config/database.py
# Uses 'traffic' schema (to be implemented)
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify credentials in Neon Console
   - Check network connectivity
   - Ensure project ID is correct

2. **Schema Not Created**
   - Check service initialization logs
   - Verify connection string format
   - Ensure proper permissions

3. **Migration Failed**
   - Check SQL syntax in migration files
   - Verify schema exists
   - Check for dependency conflicts

### Getting Help

- **Neon Documentation**: [neon.tech/docs](https://neon.tech/docs)
- **Neon Discord**: [discord.gg/neon](https://discord.gg/neon)
- **GitHub Issues**: Create issue in Local Lens repository

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files to version control
   - Use different credentials for different environments
   - Rotate passwords regularly

2. **Schema Access**
   - Use least privilege principle
   - Monitor schema access logs
   - Set up alerts for unusual activity

3. **Connection Security**
   - Always use SSL in production
   - Implement connection pooling limits
   - Monitor connection usage

## Next Steps

After completing the Neon setup:

1. **Run the migration system** to create all database schemas
2. **Test the comprehensive test suite** to verify schema isolation
3. **Start the services** and verify they connect to correct schemas
4. **Set up monitoring** for database performance and usage
5. **Configure backups** and disaster recovery procedures

Your Local Lens system is now ready with proper database schema isolation using Neon!