#!/usr/bin/env node

/**
 * Neon Project Setup Script
 * Automates the creation of Neon project and branches for Local Lens
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function executeCommand(command, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        console.log(`✅ ${description} completed`);
        return output.trim();
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        throw error;
    }
}

function checkNeonCLI() {
    try {
        execSync('neonctl --version', { stdio: 'pipe' });
        return true;
    } catch (error) {
        return false;
    }
}

async function installNeonCLI() {
    const install = await question('Neon CLI not found. Install it now? (y/n): ');
    if (install.toLowerCase() === 'y' || install.toLowerCase() === 'yes') {
        executeCommand('npm install -g neonctl', 'Installing Neon CLI');
        return true;
    }
    return false;
}

async function authenticateNeon() {
    console.log('\n🔐 Neon Authentication Required');
    console.log('Please authenticate with Neon. This will open your browser.');
    
    const proceed = await question('Continue with authentication? (y/n): ');
    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        throw new Error('Authentication required to proceed');
    }
    
    executeCommand('neonctl auth', 'Authenticating with Neon');
}

async function createNeonProject() {
    console.log('\n🏗️ Creating Neon Project');
    
    const projectName = await question('Enter project name (default: local-lens-system): ') || 'local-lens-system';
    const databaseName = await question('Enter database name (default: local_lens_db): ') || 'local_lens_db';
    
    const output = executeCommand(
        `neonctl projects create --name "${projectName}" --database-name "${databaseName}"`,
        'Creating Neon project'
    );
    
    // Extract project ID from output
    const projectIdMatch = output.match(/Project ID: ([a-zA-Z0-9-]+)/);
    if (!projectIdMatch) {
        throw new Error('Could not extract project ID from Neon CLI output');
    }
    
    const projectId = projectIdMatch[1];
    console.log(`📋 Project ID: ${projectId}`);
    
    return { projectId, projectName, databaseName };
}

async function createBranches(projectId) {
    console.log('\n🌿 Creating Database Branches');
    
    const branches = [
        { name: 'blood-donation', description: 'Blood donation platform database' },
        { name: 'complaint-management', description: 'Complaint management platform database' },
        { name: 'traffic-management', description: 'Traffic management platform database' }
    ];
    
    const createdBranches = ['main']; // main branch exists by default
    
    for (const branch of branches) {
        try {
            executeCommand(
                `neonctl branches create --project-id ${projectId} --name "${branch.name}" --parent main`,
                `Creating ${branch.name} branch`
            );
            createdBranches.push(branch.name);
        } catch (error) {
            console.warn(`⚠️ Failed to create ${branch.name} branch: ${error.message}`);
        }
    }
    
    return createdBranches;
}

async function getConnectionStrings(projectId, branches) {
    console.log('\n🔗 Retrieving Connection Strings');
    
    const connections = {};
    
    for (const branch of branches) {
        try {
            const connectionString = executeCommand(
                `neonctl connection-string --project-id ${projectId} --branch ${branch}`,
                `Getting connection string for ${branch} branch`
            );
            connections[branch] = connectionString;
        } catch (error) {
            console.warn(`⚠️ Failed to get connection string for ${branch}: ${error.message}`);
        }
    }
    
    return connections;
}

function createEnvironmentFile(projectId, connections) {
    console.log('\n📝 Creating Environment Configuration');
    
    const envContent = `# Neon Database Configuration for Local Lens
# Generated on ${new Date().toISOString()}

# Neon Project Configuration
NEON_PROJECT_ID=${projectId}
NEON_DATABASE_URL=${connections.main || 'postgresql://username:password@hostname:5432/neondb'}

# Environment
NODE_ENV=development

# Branch-specific Connection Strings
${connections.main ? `AUTH_SERVICE_DB_URL=${connections.main}` : '# AUTH_SERVICE_DB_URL='}
${connections['blood-donation'] ? `BLOOD_PLATFORM_DB_URL=${connections['blood-donation']}` : '# BLOOD_PLATFORM_DB_URL='}
${connections['complaint-management'] ? `COMPLAINT_PLATFORM_DB_URL=${connections['complaint-management']}` : '# COMPLAINT_PLATFORM_DB_URL='}
${connections['traffic-management'] ? `TRAFFIC_PLATFORM_DB_URL=${connections['traffic-management']}` : '# TRAFFIC_PLATFORM_DB_URL='}

# Testing Configuration
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/test_db
VERBOSE_TESTS=false
`;

    const envPath = path.join(process.cwd(), '.env');
    const envExamplePath = path.join(process.cwd(), '.env.example');
    
    // Update .env.example
    fs.writeFileSync(envExamplePath, envContent);
    console.log('✅ Updated .env.example');
    
    // Create .env if it doesn't exist
    if (!fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Created .env file');
    } else {
        console.log('⚠️ .env file already exists, not overwriting');
        console.log('📋 Please manually update your .env file with the new configuration');
    }
    
    return envPath;
}

async function runMigrations() {
    console.log('\n🗄️ Running Database Migrations');
    
    const runMigrations = await question('Run database migrations now? (y/n): ');
    if (runMigrations.toLowerCase() !== 'y' && runMigrations.toLowerCase() !== 'yes') {
        console.log('⏭️ Skipping migrations. Run them later with: cd shared/database && npm run migrate');
        return;
    }
    
    try {
        // Install dependencies
        executeCommand('npm install', 'Installing shared database dependencies');
        
        // Test connections
        executeCommand('npm run migrate:test', 'Testing database connections');
        
        // Run migrations
        executeCommand('npm run migrate', 'Running database migrations');
        
        console.log('✅ All migrations completed successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.log('💡 You can run migrations later with: cd shared/database && npm run migrate');
    }
}

function printSummary(projectId, branches, connections) {
    console.log('\n🎉 Neon Project Setup Complete!');
    console.log('='.repeat(50));
    console.log(`📋 Project ID: ${projectId}`);
    console.log(`🌿 Branches Created: ${branches.join(', ')}`);
    console.log('\n📁 Files Created/Updated:');
    console.log('  - .env.example (updated)');
    console.log('  - .env (created if not exists)');
    
    console.log('\n🔗 Connection Strings:');
    Object.entries(connections).forEach(([branch, url]) => {
        console.log(`  - ${branch}: ${url.substring(0, 50)}...`);
    });
    
    console.log('\n📚 Next Steps:');
    console.log('1. Review and update your .env file with correct credentials');
    console.log('2. Run migrations: cd shared/database && npm run migrate');
    console.log('3. Test the setup: npm test');
    console.log('4. Start your services and verify branch connections');
    
    console.log('\n📖 Documentation:');
    console.log('  - Setup Guide: docs/neon-setup-guide.md');
    console.log('  - Database README: shared/database/README.md');
    
    console.log('\n🔧 Troubleshooting:');
    console.log('  - Test connections: cd shared/database && npm run migrate:test');
    console.log('  - Check migration status: cd shared/database && npm run migrate:status');
    console.log('  - View Neon Console: https://console.neon.tech');
}

async function main() {
    console.log('🚀 Local Lens Neon Project Setup');
    console.log('='.repeat(40));
    
    try {
        // Check if Neon CLI is installed
        if (!checkNeonCLI()) {
            const installed = await installNeonCLI();
            if (!installed) {
                throw new Error('Neon CLI is required for this setup');
            }
        }
        
        // Authenticate with Neon
        await authenticateNeon();
        
        // Create Neon project
        const { projectId, projectName, databaseName } = await createNeonProject();
        
        // Create branches
        const branches = await createBranches(projectId);
        
        // Get connection strings
        const connections = await getConnectionStrings(projectId, branches);
        
        // Create environment file
        createEnvironmentFile(projectId, connections);
        
        // Change to shared/database directory for migrations
        process.chdir(path.join(process.cwd(), 'shared', 'database'));
        
        // Run migrations
        await runMigrations();
        
        // Change back to root directory
        process.chdir(path.join(process.cwd(), '..', '..'));
        
        // Print summary
        printSummary(projectId, branches, connections);
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log('\n💡 Manual Setup Options:');
        console.log('1. Use Neon Console: https://console.neon.tech');
        console.log('2. Follow the setup guide: docs/neon-setup-guide.md');
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the setup if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { main };