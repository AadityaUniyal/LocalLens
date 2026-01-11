#!/usr/bin/env node

/**
 * Local Lens Authentication Service
 * Centralized JWT-based authentication with role-based access control
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const redis = require('redis');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Import custom modules
const DatabaseManager = require('./config/database');
const AuthService = require('./services/authService');
const { setupLogger, logWithExtra } = require('./utils/logger');
const { validateInput, sanitizeInput } = require('./utils/helpers');

// Initialize Express app
const app = express();
const logger = setupLogger('auth-service');

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts, please try again later.'
});

// Initialize services
const dbManager = new DatabaseManager();
const authService = new AuthService();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'authentication',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime()
    });
});

// Authentication endpoints
app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
    body('name').isLength({ min: 2, max: 100 }).trim().escape(),
    body('role').optional().isIn(['citizen', 'admin', 'authority', 'donor', 'recipient', 'blood_bank', 'hospital'])
], async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { email, password, name, role = 'citizen', phone, location } = req.body;

        // Check if user already exists
        const existingUser = await authService.getUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User already exists with this email'
            });
        }

        // Create new user
        const user = await authService.createUser({
            email,
            password,
            name,
            role,
            phone,
            location
        });

        // Generate JWT token
        const token = authService.generateToken(user);
        const refreshToken = authService.generateRefreshToken(user);

        // Store refresh token
        await authService.storeRefreshToken(user.id, refreshToken);

        logWithExtra(logger, 'info', 'User registered successfully', {
            userId: user.id,
            email: user.email,
            role: user.role
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                created_at: user.created_at
            },
            token,
            refreshToken
        });

    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/api/auth/login', authLimiter, [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 })
], async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        const { email, password } = req.body;

        // Authenticate user
        const user = await authService.authenticateUser(email, password);
        if (!user) {
            logWithExtra(logger, 'warning', 'Failed login attempt', {
                email,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Check if MFA is enabled
        if (user.mfa_enabled) {
            return res.status(200).json({
                success: true,
                requiresMFA: true,
                message: 'MFA token required',
                userId: user.id // Temporary identifier for MFA verification
            });
        }

        // Generate tokens
        const token = authService.generateToken(user);
        const refreshToken = authService.generateRefreshToken(user);

        // Store refresh token
        await authService.storeRefreshToken(user.id, refreshToken);

        // Update last login
        await authService.updateLastLogin(user.id);

        logWithExtra(logger, 'info', 'User logged in successfully', {
            userId: user.id,
            email: user.email,
            role: user.role,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                platform_access: user.platform_access,
                permissions: user.permissions,
                last_login: new Date().toISOString()
            },
            token,
            refreshToken
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/api/auth/refresh-token', [
    body('refreshToken').isLength({ min: 1 })
], async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required'
            });
        }

        // Validate and refresh token
        const result = await authService.refreshAccessToken(refreshToken);
        
        if (!result.success) {
            return res.status(401).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            token: result.token,
            refreshToken: result.refreshToken
        });

    } catch (error) {
        logger.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/api/auth/logout', authService.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const refreshToken = req.body.refreshToken;

        // Invalidate refresh token
        if (refreshToken) {
            await authService.invalidateRefreshToken(refreshToken);
        }

        // Add token to blacklist (optional - for extra security)
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            await authService.blacklistToken(token);
        }

        logWithExtra(logger, 'info', 'User logged out', {
            userId,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.get('/api/auth/profile', authService.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await authService.getUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                phone: user.phone,
                location: user.location,
                platforms_access: user.platforms_access,
                created_at: user.created_at,
                last_login: user.last_login
            }
        });

    } catch (error) {
        logger.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.put('/api/auth/profile', authService.authenticateToken, [
    body('name').optional().isLength({ min: 2, max: 100 }).trim().escape(),
    body('phone').optional().isMobilePhone(),
    body('location').optional().isObject()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const userId = req.user.id;
        const updates = req.body;

        // Remove sensitive fields that shouldn't be updated via this endpoint
        delete updates.email;
        delete updates.password;
        delete updates.role;

        const updatedUser = await authService.updateUser(userId, updates);

        logWithExtra(logger, 'info', 'Profile updated', {
            userId,
            updatedFields: Object.keys(updates)
        });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                role: updatedUser.role,
                phone: updatedUser.phone,
                location: updatedUser.location,
                platforms_access: updatedUser.platforms_access
            }
        });

    } catch (error) {
        logger.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/api/auth/change-password', authService.authenticateToken, [
    body('currentPassword').isLength({ min: 1 }),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
            });
        }

        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        // Verify current password
        const user = await authService.getUserById(userId);
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Update password
        await authService.updatePassword(userId, newPassword);

        // Invalidate all existing refresh tokens for security
        await authService.invalidateAllUserTokens(userId);

        logWithExtra(logger, 'info', 'Password changed', {
            userId,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Password changed successfully. Please log in again.'
        });

    } catch (error) {
        logger.error('Password change error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Admin endpoints
app.get('/api/auth/users', authService.authenticateToken, authService.requireRole(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;
        
        const users = await authService.getUsers({
            page: parseInt(page),
            limit: parseInt(limit),
            role,
            search
        });

        res.json({
            success: true,
            users: users.data,
            pagination: {
                page: users.page,
                limit: users.limit,
                total: users.total,
                pages: users.pages
            }
        });

    } catch (error) {
        logger.error('Users fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.put('/api/auth/users/:userId/role', authService.authenticateToken, authService.requireRole(['admin']), [
    body('role').isIn(['citizen', 'admin', 'authority', 'donor', 'recipient', 'blood_bank', 'hospital'])
], async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        const updatedUser = await authService.updateUserRole(userId, role);

        logWithExtra(logger, 'info', 'User role updated by admin', {
            adminId: req.user.id,
            targetUserId: userId,
            newRole: role
        });

        res.json({
            success: true,
            message: 'User role updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                role: updatedUser.role
            }
        });

    } catch (error) {
        logger.error('Role update error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// MFA endpoints
app.post('/api/auth/mfa/setup', authService.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { method = 'totp' } = req.body;

        const mfaSetup = await authService.setupMFA(userId, method);

        logWithExtra(logger, 'info', 'MFA setup initiated', {
            userId,
            method
        });

        res.json({
            success: true,
            message: 'MFA setup initiated',
            secret: mfaSetup.secret,
            qrCode: mfaSetup.qrCode,
            backupCodes: mfaSetup.backupCodes
        });

    } catch (error) {
        logger.error('MFA setup error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to setup MFA'
        });
    }
});

app.post('/api/auth/mfa/verify-setup', authService.authenticateToken, [
    body('token').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid MFA token format'
            });
        }

        const userId = req.user.id;
        const { token } = req.body;

        await authService.verifyMFASetup(userId, token);

        logWithExtra(logger, 'info', 'MFA setup completed', {
            userId
        });

        res.json({
            success: true,
            message: 'MFA setup completed successfully'
        });

    } catch (error) {
        logger.error('MFA verification error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/auth/mfa/verify', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 }),
    body('mfaToken').isLength({ min: 6, max: 8 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input'
            });
        }

        const { email, password, mfaToken } = req.body;

        // First authenticate with email/password
        const user = await authService.authenticateUser(email, password);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Then verify MFA
        const mfaValid = await authService.verifyMFA(user.id, mfaToken);
        if (!mfaValid) {
            logWithExtra(logger, 'warning', 'Failed MFA verification', {
                userId: user.id,
                email,
                ip: req.ip
            });

            return res.status(401).json({
                success: false,
                error: 'Invalid MFA token'
            });
        }

        // Generate tokens
        const token = authService.generateToken(user);
        const refreshToken = authService.generateRefreshToken(user);

        // Store refresh token
        await authService.storeRefreshToken(user.id, refreshToken);

        // Update last login
        await authService.updateLastLogin(user.id);

        logWithExtra(logger, 'info', 'User logged in with MFA', {
            userId: user.id,
            email: user.email,
            role: user.role,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                platform_access: user.platform_access,
                last_login: new Date().toISOString()
            },
            token,
            refreshToken
        });

    } catch (error) {
        logger.error('MFA login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.delete('/api/auth/mfa/disable', authService.authenticateToken, [
    body('password').isLength({ min: 1 })
], async (req, res) => {
    try {
        const userId = req.user.id;
        const { password } = req.body;

        // Verify password before disabling MFA
        const user = await authService.getUserById(userId);
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                error: 'Invalid password'
            });
        }

        // Disable MFA
        await authService.updateUser(userId, {
            mfa_enabled: false,
            mfa_secret: null,
            mfa_method: null,
            backup_codes: null
        });

        logWithExtra(logger, 'info', 'MFA disabled', {
            userId
        });

        res.json({
            success: true,
            message: 'MFA disabled successfully'
        });

    } catch (error) {
        logger.error('MFA disable error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Password reset endpoints
app.post('/api/auth/password-reset/initiate', [
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Valid email is required'
            });
        }

        const { email } = req.body;
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');

        const result = await authService.initiatePasswordReset(email, ipAddress, userAgent);

        res.json(result);

    } catch (error) {
        logger.error('Password reset initiation error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/api/auth/password-reset/complete', [
    body('resetToken').isLength({ min: 1 }),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid reset token or password format'
            });
        }

        const { resetToken, newPassword } = req.body;
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');

        const result = await authService.completePasswordReset(resetToken, newPassword, ipAddress, userAgent);

        res.json(result);

    } catch (error) {
        logger.error('Password reset completion error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Security monitoring endpoints
app.get('/api/auth/security/stats', authService.authenticateToken, authService.requireRole(['admin']), async (req, res) => {
    try {
        const stats = await authService.getAuthStatsWithSecurity();

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error('Security stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.get('/api/auth/security/activities/:userId', authService.authenticateToken, authService.requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 50, activityType } = req.query;

        const activities = await authService.dbManager.getUserActivities(userId, {
            page: parseInt(page),
            limit: parseInt(limit),
            activityType
        });

        res.json({
            success: true,
            activities
        });

    } catch (error) {
        logger.error('User activities error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Platform integration endpoints
app.post('/api/auth/validate-platform-token', [
    body('token').isLength({ min: 1 }),
    body('platform').isIn(['blood-platform', 'complaint-platform', 'traffic-platform'])
], async (req, res) => {
    try {
        const { token, platform } = req.body;

        const result = await authService.validateTokenForPlatform(token, platform);

        if (result.success) {
            res.json(result);
        } else {
            res.status(401).json(result);
        }

    } catch (error) {
        logger.error('Platform token validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Enhanced permission management endpoints
app.post('/api/auth/permissions/grant', authService.authenticateToken, authService.requireRole(['admin']), [
    body('userId').isUUID(),
    body('permissions').isArray()
], async (req, res) => {
    try {
        const { userId, permissions } = req.body;

        const user = await authService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const currentPermissions = user.permissions || [];
        const newPermissions = [...new Set([...currentPermissions, ...permissions])];

        await authService.updateUser(userId, { permissions: newPermissions });

        logWithExtra(logger, 'info', 'Permissions granted', {
            adminId: req.user.id,
            targetUserId: userId,
            grantedPermissions: permissions
        });

        res.json({
            success: true,
            message: 'Permissions granted successfully',
            permissions: newPermissions
        });

    } catch (error) {
        logger.error('Permission grant error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/api/auth/permissions/revoke', authService.authenticateToken, authService.requireRole(['admin']), [
    body('userId').isUUID(),
    body('permissions').isArray()
], async (req, res) => {
    try {
        const { userId, permissions } = req.body;

        const user = await authService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const currentPermissions = user.permissions || [];
        const newPermissions = currentPermissions.filter(p => !permissions.includes(p));

        await authService.updateUser(userId, { permissions: newPermissions });

        logWithExtra(logger, 'info', 'Permissions revoked', {
            adminId: req.user.id,
            targetUserId: userId,
            revokedPermissions: permissions
        });

        res.json({
            success: true,
            message: 'Permissions revoked successfully',
            permissions: newPermissions
        });

    } catch (error) {
        logger.error('Permission revoke error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Platform access management
app.post('/api/auth/platform-access', authService.authenticateToken, [
    body('platform').isIn(['blood', 'complaint', 'architecture', 'traffic'])
], async (req, res) => {
    try {
        const userId = req.user.id;
        const { platform } = req.body;

        await authService.grantPlatformAccess(userId, platform);

        logWithExtra(logger, 'info', 'Platform access granted', {
            userId,
            platform
        });

        res.json({
            success: true,
            message: `Access granted to ${platform} platform`
        });

    } catch (error) {
        logger.error('Platform access error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Token validation endpoint (for other services)
app.post('/api/auth/validate-token', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }

        const decoded = authService.verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        // Check if token is blacklisted
        const isBlacklisted = await authService.isTokenBlacklisted(token);
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                error: 'Token has been revoked'
            });
        }

        // Get fresh user data
        const user = await authService.getUserById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                platforms_access: user.platforms_access
            }
        });

    } catch (error) {
        logger.error('Token validation error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await dbManager.initialize();
        logger.info('Database initialized successfully');

        // Start server
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`Authentication service started on port ${port}`);
            logger.info(`Health check: http://localhost:${port}/health`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await dbManager.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await dbManager.close();
    process.exit(0);
});

// Start the server
startServer();