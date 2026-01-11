#!/usr/bin/env node

/**
 * Neon Database Migration Runner
 * Executes migrations for all Local Lens platform branches
 */

// Load environment variables from root directory
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { NeonMigrationManager, BranchUtils } = require('./neon-config');

// Migration configuration
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_MAPPING = {
  'main': ['001_auth_service_schema.sql'],
  'blood': ['002_blood_platform_schema.sql'],
  'complaint': ['003_complaint_platform_schema.sql'],
  'traffic': ['005_traffic_platform_schema.sql']
};

/**
 * Calculate checksum for migration file
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Load migration file content
 */
async function loadMigrationFile(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`Failed to load migration file ${filename}: ${error.message}`);
  }
}

/**
 * Execute migrations for a specific branch
 */
async function migrateBranch(branchName, options = {}) {
  const { dryRun = false, force = false } = options;
  
  console.log(`\n🔄 Starting migration for branch: ${branchName}`);
  
  const migrationManager = new NeonMigrationManager(branchName);
  
  try {
    // Initialize migration table
    await migrationManager.initializeMigrationTable();
    
    // Get migrations for this branch
    const migrationFiles = MIGRATION_MAPPING[branchName] || [];
    
    if (migrationFiles.length === 0) {
      console.log(`⚠️  No migrations defined for branch: ${branchName}`);
      return { success: true, executed: 0 };
    }
    
    let executedCount = 0;
    
    for (const filename of migrationFiles) {
      console.log(`\n📄 Processing migration: ${filename}`);
      
      // Load migration content
      const migrationSQL = await loadMigrationFile(filename);
      const checksum = calculateChecksum(migrationSQL);
      
      if (dryRun) {
        console.log(`🔍 [DRY RUN] Would execute migration: ${filename}`);
        console.log(`   Checksum: ${checksum}`);
        continue;
      }
      
      // Check if migration was already executed
      const isExecuted = await migrationManager.isMigrationExecuted(filename);
      
      if (isExecuted && !force) {
        console.log(`⏭️  Migration ${filename} already executed`);
        continue;
      }
      
      if (isExecuted && force) {
        console.log(`🔄 Force re-executing migration: ${filename}`);
      }
      
      // Execute migration
      try {
        const wasExecuted = await migrationManager.executeMigration(filename, migrationSQL, checksum);
        if (wasExecuted) {
          executedCount++;
        }
      } catch (error) {
        console.error(`❌ Migration ${filename} failed:`, error.message);
        throw error;
      }
    }
    
    console.log(`✅ Branch ${branchName} migration completed. Executed: ${executedCount} migrations`);
    
    return { success: true, executed: executedCount };
    
  } catch (error) {
    console.error(`❌ Branch ${branchName} migration failed:`, error.message);
    return { success: false, error: error.message };
  } finally {
    await migrationManager.close();
  }
}

/**
 * Execute migrations for all branches
 */
async function migrateAll(options = {}) {
  console.log('🚀 Starting Local Lens database migration...');
  console.log('📊 Available branches:', BranchUtils.getAllBranches().join(', '));
  
  const results = {};
  let totalExecuted = 0;
  let failedBranches = [];
  
  for (const branchName of BranchUtils.getAllBranches()) {
    try {
      const result = await migrateBranch(branchName, options);
      results[branchName] = result;
      
      if (result.success) {
        totalExecuted += result.executed;
      } else {
        failedBranches.push(branchName);
      }
    } catch (error) {
      results[branchName] = { success: false, error: error.message };
      failedBranches.push(branchName);
    }
  }
  
  // Summary
  console.log('\n📋 Migration Summary:');
  console.log('='.repeat(50));
  
  for (const [branchName, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    const executed = result.executed || 0;
    console.log(`${status} ${branchName}: ${executed} migrations executed`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('='.repeat(50));
  console.log(`📊 Total migrations executed: ${totalExecuted}`);
  
  if (failedBranches.length > 0) {
    console.log(`❌ Failed branches: ${failedBranches.join(', ')}`);
    process.exit(1);
  } else {
    console.log('🎉 All migrations completed successfully!');
  }
}

/**
 * Show migration status for all branches
 */
async function showStatus() {
  console.log('📊 Migration Status Report');
  console.log('='.repeat(60));
  
  for (const branchName of BranchUtils.getAllBranches()) {
    console.log(`\n🔍 Branch: ${branchName}`);
    
    const migrationManager = new NeonMigrationManager(branchName);
    
    try {
      await migrationManager.initializeMigrationTable();
      const history = await migrationManager.getMigrationHistory();
      
      console.log(`   Executed migrations: ${history.length}`);
      
      if (history.length > 0) {
        console.log('   Migration History:');
        history.forEach(migration => {
          console.log(`     - ${migration.migration_name} (${migration.executed_at})`);
        });
      }
      
      // Check pending migrations
      const availableMigrations = MIGRATION_MAPPING[branchName] || [];
      const executedMigrations = history.map(h => h.migration_name);
      const pendingMigrations = availableMigrations.filter(m => !executedMigrations.includes(m));
      
      if (pendingMigrations.length > 0) {
        console.log(`   Pending migrations: ${pendingMigrations.join(', ')}`);
      } else {
        console.log('   ✅ All migrations up to date');
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } finally {
      await migrationManager.close();
    }
  }
}

/**
 * Test database connections for all branches
 */
async function testConnections() {
  console.log('🔍 Testing Neon database connections...');
  console.log('='.repeat(50));
  
  for (const branchName of BranchUtils.getAllBranches()) {
    console.log(`\n🔗 Testing branch: ${branchName}`);
    
    const migrationManager = new NeonMigrationManager(branchName);
    
    try {
      await migrationManager.dbManager.initialize();
      const healthCheck = await migrationManager.dbManager.healthCheck();
      
      if (healthCheck.healthy) {
        console.log(`   ✅ Connection successful`);
        console.log(`   📊 Timestamp: ${healthCheck.timestamp}`);
        console.log(`   🔗 Connection: ${healthCheck.connectionString}`);
      } else {
        console.log(`   ❌ Connection failed: ${healthCheck.error}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Connection error: ${error.message}`);
    } finally {
      await migrationManager.close();
    }
  }
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse options
  const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    branch: args.find(arg => arg.startsWith('--branch='))?.split('=')[1]
  };
  
  try {
    switch (command) {
      case 'migrate':
        if (options.branch) {
          if (!BranchUtils.isValidBranch(options.branch)) {
            console.error(`❌ Invalid branch: ${options.branch}`);
            console.error(`Available branches: ${BranchUtils.getAllBranches().join(', ')}`);
            process.exit(1);
          }
          await migrateBranch(options.branch, options);
        } else {
          await migrateAll(options);
        }
        break;
        
      case 'status':
        await showStatus();
        break;
        
      case 'test':
        await testConnections();
        break;
        
      case 'help':
      default:
        console.log(`
🗄️  Local Lens Database Migration Tool

Usage:
  node migrate.js <command> [options]

Commands:
  migrate     Execute migrations for all branches or specific branch
  status      Show migration status for all branches
  test        Test database connections for all branches
  help        Show this help message

Options:
  --branch=<name>    Execute migration for specific branch only
  --dry-run          Show what would be executed without running migrations
  --force            Force re-execution of already executed migrations

Examples:
  node migrate.js migrate                    # Migrate all branches
  node migrate.js migrate --branch=main      # Migrate main branch only
  node migrate.js migrate --dry-run          # Show what would be executed
  node migrate.js status                     # Show migration status
  node migrate.js test                       # Test all connections

Available branches: ${BranchUtils.getAllBranches().join(', ')}
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Migration tool error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  migrateBranch,
  migrateAll,
  showStatus,
  testConnections
};