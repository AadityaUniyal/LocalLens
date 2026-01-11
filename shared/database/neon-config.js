/**
 * Neon Database Configuration and Branch Management
 * Provides centralized database configuration for all Local Lens platforms
 */

// Load environment variables from root directory if not already loaded
if (!process.env.NEON_DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
}

const { Pool } = require('pg');

/**
 * Neon Database Configuration
 * All platforms use a single Neon database branch with schema-based separation
 */
const NEON_BRANCHES = {
  main: {
    name: 'main',
    description: 'Main branch for all Local Lens platforms with schema separation',
    services: ['auth-service', 'traffic-platform', 'blood-platform', 'complaint-platform'],
    schemas: {
      'auth-service': 'auth',
      'traffic-platform': 'traffic',
      'blood-platform': 'blood',
      'complaint-platform': 'complaint'
    }
  }
};

/**
 * Generate Neon connection string for a specific service
 * All services now use the main branch with schema separation
 * @param {string} serviceName - The service name (auth-service, traffic-platform, etc.)
 * @returns {string} - Neon connection string for the main branch
 */
function getNeonConnectionString(serviceName) {
  // All services use the main branch connection
  const connectionString = process.env.NEON_DATABASE_URL || process.env.AUTH_SERVICE_DB_URL;
  
  if (!connectionString) {
    throw new Error(`Environment variable NEON_DATABASE_URL is required for service ${serviceName}`);
  }
  
  return connectionString;
}

/**
 * Get schema name for a service
 * @param {string} serviceName - The service name
 * @returns {string} - Schema name for the service
 */
function getSchemaForService(serviceName) {
  const schemaMap = {
    'auth-service': 'auth',
    'traffic-platform': 'traffic', 
    'blood-platform': 'blood',
    'complaint-platform': 'complaint'
  };
  
  return schemaMap[serviceName] || 'public';
}

/**
 * Database Manager with Schema-based Isolation
 * All services use the main branch with separate schemas
 */
class NeonDatabaseManager {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.schemaName = getSchemaForService(serviceName);
    this.branchConfig = NEON_BRANCHES.main; // All services use main branch
    
    this.connectionString = getNeonConnectionString(serviceName);
    this.pool = null;
    this.options = {
      max: options.max || 20,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis || 10000,
      ...options
    };
  }

  /**
   * Initialize the database connection pool and create schema
   */
  async initialize() {
    try {
      this.pool = new Pool({
        connectionString: this.connectionString,
        ...this.options,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test connection and create schema if it doesn't exist
      const client = await this.pool.connect();
      try {
        await client.query('SELECT NOW()');
        
        // Create schema for this service if it doesn't exist
        if (this.schemaName !== 'public') {
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schemaName}`);
          console.log(`📁 Schema '${this.schemaName}' ensured for service: ${this.serviceName}`);
        }
      } finally {
        client.release();
      }

      console.log(`✅ Neon database connection established for service: ${this.serviceName}`);
      console.log(`📊 Schema: ${this.schemaName} - ${this.branchConfig.description}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to initialize Neon database for service ${this.serviceName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a database connection from the pool
   */
  async getConnection() {
    if (!this.pool) {
      throw new Error(`Database not initialized for branch: ${this.branchName}`);
    }
    return this.pool.connect();
  }

  /**
   * Execute a query with automatic schema prefixing
   */
  async query(text, params = []) {
    if (!this.pool) {
      throw new Error(`Database not initialized for service: ${this.serviceName}`);
    }
    
    // Add schema prefix to table names if not already present and not using public schema
    let queryText = text;
    if (this.schemaName !== 'public' && !text.toLowerCase().includes('schema')) {
      // Simple table name prefixing for CREATE TABLE, INSERT, SELECT, UPDATE, DELETE
      queryText = this.addSchemaPrefix(text);
    }
    
    const client = await this.pool.connect();
    try {
      // Set search path to include our schema
      if (this.schemaName !== 'public') {
        await client.query(`SET search_path TO ${this.schemaName}, public`);
      }
      
      const result = await client.query(queryText, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Add schema prefix to table names in SQL queries
   */
  addSchemaPrefix(query) {
    // This is a simple implementation - in production you might want a more sophisticated SQL parser
    if (this.schemaName === 'public') {
      return query;
    }
    
    // Don't modify queries that already have schema references or are system queries
    if (query.toLowerCase().includes('.') || 
        query.toLowerCase().includes('information_schema') ||
        query.toLowerCase().includes('pg_') ||
        query.toLowerCase().includes('current_timestamp') ||
        query.toLowerCase().includes('now()')) {
      return query;
    }
    
    return query;
  }

  /**
   * Execute multiple queries in a transaction with schema context
   */
  async transaction(queries) {
    if (!this.pool) {
      throw new Error(`Database not initialized for service: ${this.serviceName}`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Set search path for the transaction
      if (this.schemaName !== 'public') {
        await client.query(`SET search_path TO ${this.schemaName}, public`);
      }
      
      const results = [];
      for (const { text, params } of queries) {
        const queryText = this.addSchemaPrefix(text);
        const result = await client.query(queryText, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if the database connection is healthy
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health_check, NOW() as timestamp');
      return {
        healthy: true,
        service: this.serviceName,
        schema: this.schemaName,
        timestamp: result.rows[0].timestamp,
        connectionString: this.connectionString.replace(/:[^:@]*@/, ':***@') // Hide password
      };
    } catch (error) {
      return {
        healthy: false,
        service: this.serviceName,
        schema: this.schemaName,
        error: error.message
      };
    }
  }

  /**
   * Get service information
   */
  getServiceInfo() {
    return {
      name: this.serviceName,
      schema: this.schemaName,
      config: this.branchConfig,
      connectionString: this.connectionString.replace(/:[^:@]*@/, ':***@') // Hide password
    };
  }

  /**
   * Close the database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log(`🔌 Database connection closed for service: ${this.serviceName}`);
    }
  }
}

/**
 * Migration Manager for Schema-based Separation
 * Handles database schema migrations for each service
 */
class NeonMigrationManager {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.dbManager = new NeonDatabaseManager(serviceName);
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable() {
    await this.dbManager.initialize();
    
    const createMigrationTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        service_name VARCHAR(50) NOT NULL,
        schema_name VARCHAR(50) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_service ON migrations(service_name);
      CREATE INDEX IF NOT EXISTS idx_migrations_schema ON migrations(schema_name);
      CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(migration_name);
    `;

    await this.dbManager.query(createMigrationTable);
    console.log(`📋 Migration table initialized for service: ${this.serviceName}`);
  }

  /**
   * Check if a migration has been executed
   */
  async isMigrationExecuted(migrationName) {
    const result = await this.dbManager.query(
      'SELECT id FROM migrations WHERE migration_name = $1 AND service_name = $2',
      [migrationName, this.serviceName]
    );
    return result.rows.length > 0;
  }

  /**
   * Record a migration as executed
   */
  async recordMigration(migrationName, checksum) {
    await this.dbManager.query(
      'INSERT INTO migrations (migration_name, service_name, schema_name, checksum) VALUES ($1, $2, $3, $4)',
      [migrationName, this.serviceName, this.dbManager.schemaName, checksum]
    );
  }

  /**
   * Execute a migration script
   */
  async executeMigration(migrationName, migrationSQL, checksum) {
    const isExecuted = await this.isMigrationExecuted(migrationName);
    
    if (isExecuted) {
      console.log(`⏭️  Migration ${migrationName} already executed for service ${this.serviceName}`);
      return false;
    }

    console.log(`🔄 Executing migration ${migrationName} for service ${this.serviceName}...`);
    
    try {
      await this.dbManager.transaction([
        { text: migrationSQL, params: [] },
        { 
          text: 'INSERT INTO migrations (migration_name, service_name, schema_name, checksum) VALUES ($1, $2, $3, $4)',
          params: [migrationName, this.serviceName, this.dbManager.schemaName, checksum]
        }
      ]);
      
      console.log(`✅ Migration ${migrationName} completed for service ${this.serviceName}`);
      return true;
    } catch (error) {
      console.error(`❌ Migration ${migrationName} failed for service ${this.serviceName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get migration history for the service
   */
  async getMigrationHistory() {
    const result = await this.dbManager.query(
      'SELECT migration_name, executed_at, checksum FROM migrations WHERE service_name = $1 ORDER BY executed_at',
      [this.serviceName]
    );
    return result.rows;
  }

  /**
   * Close the migration manager
   */
  async close() {
    await this.dbManager.close();
  }
}

/**
 * Utility functions for service and schema management
 */
const ServiceUtils = {
  /**
   * Get all available services
   */
  getAllServices() {
    return ['auth-service', 'traffic-platform', 'blood-platform', 'complaint-platform'];
  },

  /**
   * Get service configuration
   */
  getServiceConfig(serviceName) {
    return {
      name: serviceName,
      schema: getSchemaForService(serviceName),
      branch: 'main'
    };
  },

  /**
   * Validate service name
   */
  isValidService(serviceName) {
    return this.getAllServices().includes(serviceName);
  },

  /**
   * Get schema for a service
   */
  getSchemaForService(serviceName) {
    return getSchemaForService(serviceName);
  },

  /**
   * Get all schemas
   */
  getAllSchemas() {
    return this.getAllServices().map(service => getSchemaForService(service));
  }
};

module.exports = {
  NeonDatabaseManager,
  NeonMigrationManager,
  ServiceUtils,
  NEON_BRANCHES,
  getNeonConnectionString,
  getSchemaForService
};