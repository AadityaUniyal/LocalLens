#!/usr/bin/env node

/**
 * Blood Platform Implementation Validation Script
 * Validates that all required components are properly implemented
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
        log(`✅ ${description}: ${filePath}`, 'green');
        return true;
    } else {
        log(`❌ ${description}: ${filePath} - NOT FOUND`, 'red');
        return false;
    }
}

function checkDirectoryExists(dirPath, description) {
    const fullPath = path.join(__dirname, '..', dirPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        log(`✅ ${description}: ${dirPath}`, 'green');
        return true;
    } else {
        log(`❌ ${description}: ${dirPath} - NOT FOUND`, 'red');
        return false;
    }
}

function checkPackageJson() {
    const packagePath = path.join(__dirname, '..', 'package.json');
    if (!fs.existsSync(packagePath)) {
        log('❌ package.json not found', 'red');
        return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const requiredDeps = [
        'express', 'socket.io', 'pg', 'cors', 'helmet', 'dotenv',
        'express-rate-limit', 'express-validator', 'winston', 'jsonwebtoken'
    ];

    let allDepsPresent = true;
    requiredDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
            log(`✅ Dependency: ${dep}`, 'green');
        } else {
            log(`❌ Missing dependency: ${dep}`, 'red');
            allDepsPresent = false;
        }
    });

    return allDepsPresent;
}

function checkEnvironmentConfig() {
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    if (!fs.existsSync(envExamplePath)) {
        log('❌ .env.example not found', 'red');
        return false;
    }

    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    const requiredVars = [
        'PORT', 'NODE_ENV', 'NEON_BLOOD_DATABASE_URL', 'JWT_SECRET',
        'CORS_ORIGIN', 'EMERGENCY_RESPONSE_TIME_MINUTES'
    ];

    let allVarsPresent = true;
    requiredVars.forEach(varName => {
        if (envContent.includes(varName)) {
            log(`✅ Environment variable: ${varName}`, 'green');
        } else {
            log(`❌ Missing environment variable: ${varName}`, 'red');
            allVarsPresent = false;
        }
    });

    return allVarsPresent;
}

function validateImplementation() {
    log('\n🩸 Blood Platform Implementation Validation', 'blue');
    log('=' .repeat(50), 'blue');

    let allChecksPass = true;

    // Core files
    log('\n📁 Core Files:', 'yellow');
    allChecksPass &= checkFileExists('src/index.js', 'Main server file');
    allChecksPass &= checkFileExists('package.json', 'Package configuration');
    allChecksPass &= checkFileExists('README.md', 'Documentation');
    allChecksPass &= checkFileExists('Dockerfile', 'Docker configuration');

    // Configuration files
    log('\n⚙️ Configuration:', 'yellow');
    allChecksPass &= checkFileExists('.env.example', 'Environment template');
    allChecksPass &= checkFileExists('src/config/database.js', 'Database configuration');

    // Services
    log('\n🔧 Services:', 'yellow');
    allChecksPass &= checkFileExists('src/services/matchingService.js', 'Matching service');
    allChecksPass &= checkFileExists('src/services/notificationService.js', 'Notification service');
    allChecksPass &= checkFileExists('src/services/inventoryService.js', 'Inventory service');
    allChecksPass &= checkFileExists('src/services/emergencyService.js', 'Emergency service');

    // Controllers
    log('\n🎮 Controllers:', 'yellow');
    allChecksPass &= checkFileExists('src/controllers/donorController.js', 'Donor controller');
    allChecksPass &= checkFileExists('src/controllers/recipientController.js', 'Recipient controller');
    allChecksPass &= checkFileExists('src/controllers/analyticsController.js', 'Analytics controller');

    // Routes
    log('\n🛣️ Routes:', 'yellow');
    allChecksPass &= checkFileExists('src/routes/donors.js', 'Donor routes');
    allChecksPass &= checkFileExists('src/routes/requests.js', 'Request routes');
    allChecksPass &= checkFileExists('src/routes/analytics.js', 'Analytics routes');

    // Middleware
    log('\n🛡️ Middleware:', 'yellow');
    allChecksPass &= checkFileExists('src/middleware/authMiddleware.js', 'Authentication middleware');
    allChecksPass &= checkFileExists('src/middleware/validationMiddleware.js', 'Validation middleware');

    // Utilities
    log('\n🔧 Utilities:', 'yellow');
    allChecksPass &= checkFileExists('src/utils/helpers.js', 'Helper functions');
    allChecksPass &= checkFileExists('src/utils/logger.js', 'Logging utilities');

    // Tests
    log('\n🧪 Tests:', 'yellow');
    allChecksPass &= checkDirectoryExists('tests', 'Test directory');
    allChecksPass &= checkFileExists('tests/integration.test.js', 'Integration tests');

    // Scripts
    log('\n📜 Scripts:', 'yellow');
    allChecksPass &= checkDirectoryExists('scripts', 'Scripts directory');
    allChecksPass &= checkFileExists('scripts/deploy.sh', 'Linux deployment script');
    allChecksPass &= checkFileExists('scripts/deploy.ps1', 'Windows deployment script');

    // Documentation
    log('\n📚 Documentation:', 'yellow');
    allChecksPass &= checkFileExists('API_DOCUMENTATION.md', 'API documentation');

    // Package dependencies
    log('\n📦 Dependencies:', 'yellow');
    allChecksPass &= checkPackageJson();

    // Environment configuration
    log('\n🌍 Environment:', 'yellow');
    allChecksPass &= checkEnvironmentConfig();

    // Database schema
    log('\n🗄️ Database:', 'yellow');
    allChecksPass &= checkFileExists('../shared/database/migrations/002_blood_platform_schema.sql', 'Database schema');

    // Final result
    log('\n' + '=' .repeat(50), 'blue');
    if (allChecksPass) {
        log('🎉 All implementation checks PASSED!', 'green');
        log('✅ Blood Platform is ready for deployment', 'green');
        
        log('\n📋 Next Steps:', 'blue');
        log('1. Configure your .env file with actual values', 'yellow');
        log('2. Set up your Neon database branch', 'yellow');
        log('3. Apply the database schema', 'yellow');
        log('4. Run tests: npm test', 'yellow');
        log('5. Start the server: npm run dev', 'yellow');
        log('6. Deploy: ./scripts/deploy.sh', 'yellow');
        
        return true;
    } else {
        log('❌ Some implementation checks FAILED!', 'red');
        log('⚠️ Please fix the missing components before deployment', 'yellow');
        return false;
    }
}

// Run validation
if (require.main === module) {
    const success = validateImplementation();
    process.exit(success ? 0 : 1);
}

module.exports = { validateImplementation };