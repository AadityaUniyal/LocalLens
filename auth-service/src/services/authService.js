/**
 * Authentication Service - Core Business Logic
 * Handles user authentication, JWT tokens, and session management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../config/database');

class AuthService {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        this.redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });
        
        this.redisClient.connect();
        
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        this.refreshTokenExpiresIn = '7d';
    }

    /**
     * Create a new user
     */
    async createUser(userData) {
        const { email, password, name, role = 'citizen', phone, location } = userData;
        
        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user in database
        const user = await this.dbManager.createUser({
            email,
            password_hash: passwordHash,
            name,
            role,
            phone,
            location: location ? JSON.stringify(location) : null,
            platforms_access: [role === 'admin' ? 'all' : 'basic']
        });
        
        return user;
    }

    /**
     * Authenticate user with email and password
     */
    async authenticateUser(email, password) {
        const user = await this.dbManager.getUserByEmail(email);
        
        if (!user) {
            return null;
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return null;
        }
        
        return user;
    }

    /**
     * Generate JWT access token with enhanced structure
     */
    generateToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            platformAccess: user.platform_access || [],
            permissions: user.permissions || [],
            iat: Math.floor(Date.now() / 1000),
            jti: require('uuid').v4(), // JWT ID for token tracking
            sessionId: require('uuid').v4() // Session identifier
        };
        
        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn,
            issuer: 'local-lens-auth',
            audience: 'local-lens-platforms'
        });
    }

    /**
     * Generate refresh token with enhanced security
     */
    generateRefreshToken(user) {
        const payload = {
            userId: user.id,
            tokenId: uuidv4(),
            type: 'refresh',
            role: user.role,
            iat: Math.floor(Date.now() / 1000)
        };
        
        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.refreshTokenExpiresIn,
            issuer: 'local-lens-auth'
        });
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            return null;
        }
    }

    /**
     * Store refresh token in Redis
     */
    async storeRefreshToken(userId, refreshToken) {
        const decoded = jwt.decode(refreshToken);
        const key = `refresh_token:${userId}:${decoded.tokenId}`;
        
        // Store for 7 days
        await this.redisClient.setEx(key, 7 * 24 * 60 * 60, refreshToken);
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, this.jwtSecret);
            
            if (decoded.type !== 'refresh') {
                return { success: false, error: 'Invalid token type' };
            }
            
            // Check if refresh token exists in Redis
            const key = `refresh_token:${decoded.userId}:${decoded.tokenId}`;
            const storedToken = await this.redisClient.get(key);
            
            if (!storedToken || storedToken !== refreshToken) {
                return { success: false, error: 'Invalid refresh token' };
            }
            
            // Get user data
            const user = await this.dbManager.getUserById(decoded.userId);
            if (!user) {
                return { success: false, error: 'User not found' };
            }
            
            // Generate new tokens
            const newAccessToken = this.generateToken(user);
            const newRefreshToken = this.generateRefreshToken(user);
            
            // Store new refresh token and remove old one
            await this.redisClient.del(key);
            await this.storeRefreshToken(user.id, newRefreshToken);
            
            return {
                success: true,
                token: newAccessToken,
                refreshToken: newRefreshToken
            };
            
        } catch (error) {
            return { success: false, error: 'Invalid refresh token' };
        }
    }

    /**
     * Invalidate refresh token
     */
    async invalidateRefreshToken(refreshToken) {
        try {
            const decoded = jwt.decode(refreshToken);
            if (decoded && decoded.tokenId) {
                const key = `refresh_token:${decoded.userId}:${decoded.tokenId}`;
                await this.redisClient.del(key);
            }
        } catch (error) {
            // Token might be malformed, ignore error
        }
    }

    /**
     * Invalidate all refresh tokens for a user
     */
    async invalidateAllUserTokens(userId) {
        const pattern = `refresh_token:${userId}:*`;
        const keys = await this.redisClient.keys(pattern);
        
        if (keys.length > 0) {
            await this.redisClient.del(keys);
        }
    }

    /**
     * Blacklist access token
     */
    async blacklistToken(token) {
        try {
            const decoded = jwt.decode(token);
            if (decoded && decoded.exp) {
                const key = `blacklist:${token}`;
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                
                if (ttl > 0) {
                    await this.redisClient.setEx(key, ttl, 'blacklisted');
                }
            }
        } catch (error) {
            // Token might be malformed, ignore error
        }
    }

    /**
     * Check if token is blacklisted
     */
    async isTokenBlacklisted(token) {
        const key = `blacklist:${token}`;
        const result = await this.redisClient.get(key);
        return result === 'blacklisted';
    }

    /**
     * Get user by ID
     */
    async getUserById(userId) {
        return await this.dbManager.getUserById(userId);
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        return await this.dbManager.getUserByEmail(email);
    }

    /**
     * Update user information
     */
    async updateUser(userId, updates) {
        return await this.dbManager.updateUser(userId, updates);
    }

    /**
     * Update user password
     */
    async updatePassword(userId, newPassword) {
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);
        
        return await this.dbManager.updateUser(userId, {
            password_hash: passwordHash,
            password_changed_at: new Date()
        });
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(userId) {
        return await this.dbManager.updateUser(userId, {
            last_login: new Date()
        });
    }

    /**
     * Get users with pagination and filtering
     */
    async getUsers(options = {}) {
        return await this.dbManager.getUsers(options);
    }

    /**
     * Update user role (admin only)
     */
    async updateUserRole(userId, role) {
        return await this.dbManager.updateUser(userId, { role });
    }

    /**
     * Grant platform access to user
     */
    async grantPlatformAccess(userId, platform) {
        const user = await this.getUserById(userId);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        let platformsAccess = user.platforms_access || [];
        
        if (!platformsAccess.includes(platform) && !platformsAccess.includes('all')) {
            platformsAccess.push(platform);
            await this.updateUser(userId, { platforms_access: platformsAccess });
        }
    }

    /**
     * Middleware to authenticate JWT token
     */
    authenticateToken = async (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token is required'
            });
        }

        try {
            // Check if token is blacklisted
            const isBlacklisted = await this.isTokenBlacklisted(token);
            if (isBlacklisted) {
                return res.status(401).json({
                    success: false,
                    error: 'Token has been revoked'
                });
            }

            const decoded = this.verifyToken(token);
            if (!decoded) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired token'
                });
            }

            // Get fresh user data
            const user = await this.getUserById(decoded.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'User not found'
                });
            }

            req.user = user;
            next();

        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
    };

    /**
     * Middleware to require specific roles
     */
    requireRole = (allowedRoles) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions'
                });
            }

            next();
        };
    };

    /**
     * Middleware to require platform access
     */
    requirePlatformAccess = (platform) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const platformsAccess = req.user.platform_access || [];
            
            if (!platformsAccess.includes(platform) && 
                !platformsAccess.includes('all') && 
                req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: `Access denied to ${platform} platform`
                });
            }

            next();
        };
    };

    /**
     * Enhanced role-based access control with permissions
     */
    requirePermission = (permission) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const userPermissions = req.user.permissions || [];
            const hasPermission = userPermissions.includes(permission) || 
                                userPermissions.includes('*') ||
                                req.user.role === 'admin';

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: `Permission denied: ${permission}`
                });
            }

            next();
        };
    };

    /**
     * Check multiple permissions (AND logic)
     */
    requireAllPermissions = (permissions) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const userPermissions = req.user.permissions || [];
            const hasAllPermissions = permissions.every(permission => 
                userPermissions.includes(permission) || 
                userPermissions.includes('*') ||
                req.user.role === 'admin'
            );

            if (!hasAllPermissions) {
                return res.status(403).json({
                    success: false,
                    error: `Missing required permissions: ${permissions.join(', ')}`
                });
            }

            next();
        };
    };

    /**
     * Check multiple permissions (OR logic)
     */
    requireAnyPermission = (permissions) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const userPermissions = req.user.permissions || [];
            const hasAnyPermission = permissions.some(permission => 
                userPermissions.includes(permission) || 
                userPermissions.includes('*') ||
                req.user.role === 'admin'
            );

            if (!hasAnyPermission) {
                return res.status(403).json({
                    success: false,
                    error: `Requires one of: ${permissions.join(', ')}`
                });
            }

            next();
        };
    };

    /**
     * Multi-factor authentication setup
     */
    async setupMFA(userId, method = 'totp') {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const secret = require('speakeasy').generateSecret({
            name: `Local Lens (${user.email})`,
            issuer: 'Local Lens'
        });

        // Store MFA secret temporarily until verified
        const key = `mfa_setup:${userId}`;
        await this.redisClient.setEx(key, 300, JSON.stringify({ // 5 minutes
            secret: secret.base32,
            method,
            createdAt: new Date().toISOString()
        }));

        return {
            secret: secret.base32,
            qrCode: secret.otpauth_url,
            backupCodes: this.generateBackupCodes()
        };
    }

    /**
     * Verify MFA setup
     */
    async verifyMFASetup(userId, token) {
        const key = `mfa_setup:${userId}`;
        const setupData = await this.redisClient.get(key);
        
        if (!setupData) {
            throw new Error('MFA setup not found or expired');
        }

        const { secret } = JSON.parse(setupData);
        const verified = require('speakeasy').totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 2
        });

        if (!verified) {
            throw new Error('Invalid MFA token');
        }

        // Save MFA settings to user
        await this.updateUser(userId, {
            mfa_enabled: true,
            mfa_secret: secret,
            mfa_method: 'totp'
        });

        // Clean up setup data
        await this.redisClient.del(key);

        return true;
    }

    /**
     * Verify MFA token during login
     */
    async verifyMFA(userId, token) {
        const user = await this.getUserById(userId);
        
        if (!user || !user.mfa_enabled) {
            return false;
        }

        // Check TOTP token
        if (user.mfa_method === 'totp') {
            return require('speakeasy').totp.verify({
                secret: user.mfa_secret,
                encoding: 'base32',
                token,
                window: 2
            });
        }

        // Check backup codes
        if (user.backup_codes && user.backup_codes.includes(token)) {
            // Remove used backup code
            const updatedCodes = user.backup_codes.filter(code => code !== token);
            await this.updateUser(userId, { backup_codes: updatedCodes });
            return true;
        }

        return false;
    }

    /**
     * Generate backup codes for MFA
     */
    generateBackupCodes(count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            codes.push(require('crypto').randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }

    /**
     * Enhanced token refresh with security checks
     */
    async refreshAccessToken(refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, this.jwtSecret);
            
            if (decoded.type !== 'refresh') {
                return { success: false, error: 'Invalid token type' };
            }
            
            // Check if refresh token exists in Redis
            const key = `refresh_token:${decoded.userId}:${decoded.tokenId}`;
            const storedToken = await this.redisClient.get(key);
            
            if (!storedToken || storedToken !== refreshToken) {
                return { success: false, error: 'Invalid refresh token' };
            }
            
            // Get user data
            const user = await this.dbManager.getUserById(decoded.userId);
            if (!user || !user.is_active) {
                return { success: false, error: 'User not found or inactive' };
            }
            
            // Check if user role has changed (security measure)
            if (user.role !== decoded.role) {
                // Invalidate all tokens if role changed
                await this.invalidateAllUserTokens(user.id);
                return { success: false, error: 'User permissions changed, please login again' };
            }
            
            // Generate new tokens
            const newAccessToken = this.generateToken(user);
            const newRefreshToken = this.generateRefreshToken(user);
            
            // Store new refresh token and remove old one
            await this.redisClient.del(key);
            await this.storeRefreshToken(user.id, newRefreshToken);
            
            return {
                success: true,
                token: newAccessToken,
                refreshToken: newRefreshToken
            };
            
        } catch (error) {
            return { success: false, error: 'Invalid refresh token' };
        }
    }

    /**
     * Generate password reset token
     */
    async generatePasswordResetToken(email) {
        const user = await this.getUserByEmail(email);
        
        if (!user) {
            return null;
        }
        
        const resetToken = uuidv4();
        const key = `password_reset:${resetToken}`;
        
        // Store reset token for 1 hour
        await this.redisClient.setEx(key, 3600, JSON.stringify({
            userId: user.id,
            email: user.email,
            createdAt: new Date().toISOString()
        }));
        
        return resetToken;
    }

    /**
     * Verify password reset token
     */
    async verifyPasswordResetToken(resetToken) {
        const key = `password_reset:${resetToken}`;
        const data = await this.redisClient.get(key);
        
        if (!data) {
            return null;
        }
        
        return JSON.parse(data);
    }

    /**
     * Reset password using reset token
     */
    async resetPassword(resetToken, newPassword) {
        const resetData = await this.verifyPasswordResetToken(resetToken);
        
        if (!resetData) {
            throw new Error('Invalid or expired reset token');
        }
        
        // Update password
        await this.updatePassword(resetData.userId, newPassword);
        
        // Invalidate reset token
        const key = `password_reset:${resetToken}`;
        await this.redisClient.del(key);
        
        // Invalidate all user sessions for security
        await this.invalidateAllUserTokens(resetData.userId);
        
        return true;
    }

    /**
     * Get authentication statistics
     */
    async getAuthStats() {
        const stats = await this.dbManager.getAuthStats();
        
        // Add Redis stats
        const redisInfo = await this.redisClient.info('memory');
        const activeTokens = await this.redisClient.keys('refresh_token:*');
        
        return {
            ...stats,
            active_sessions: activeTokens.length,
            redis_memory_usage: redisInfo
        };
    }

    /**
     * Close connections
     */
    async close() {
        await this.redisClient.quit();
        await this.dbManager.close();
    }

    /**
     * Comprehensive audit logging system
     */
    async logUserActivity(userId, activityType, activityData = {}, ipAddress = null, userAgent = null, platform = null, success = true, errorMessage = null) {
        try {
            await this.dbManager.logUserActivity(userId, activityType, activityData, ipAddress, userAgent, platform, success, errorMessage);
        } catch (error) {
            console.error('Failed to log user activity:', error);
        }
    }

    /**
     * Enhanced authentication with audit logging
     */
    async authenticateUserWithAudit(email, password, ipAddress = null, userAgent = null) {
        const startTime = Date.now();
        let user = null;
        let success = false;
        let errorMessage = null;

        try {
            user = await this.authenticateUser(email, password);
            success = user !== null;
            
            if (!success) {
                errorMessage = 'Invalid credentials';
            }
        } catch (error) {
            errorMessage = error.message;
        }

        // Log authentication attempt
        if (user) {
            await this.logUserActivity(
                user.id,
                'login_attempt',
                {
                    email,
                    responseTime: Date.now() - startTime,
                    success
                },
                ipAddress,
                userAgent,
                'auth-service',
                success,
                errorMessage
            );
        } else {
            // Log failed attempt with email (for security monitoring)
            await this.logUserActivity(
                null,
                'failed_login_attempt',
                {
                    email,
                    responseTime: Date.now() - startTime,
                    reason: errorMessage
                },
                ipAddress,
                userAgent,
                'auth-service',
                false,
                errorMessage
            );
        }

        return user;
    }

    /**
     * Password reset functionality with security measures
     */
    async initiatePasswordReset(email, ipAddress = null, userAgent = null) {
        const user = await this.getUserByEmail(email);
        
        if (!user) {
            // Log suspicious password reset attempt
            await this.logUserActivity(
                null,
                'password_reset_attempt',
                { email, reason: 'User not found' },
                ipAddress,
                userAgent,
                'auth-service',
                false,
                'User not found'
            );
            
            // Return success to prevent email enumeration
            return { success: true, message: 'If the email exists, a reset link has been sent' };
        }

        // Check for recent reset attempts (rate limiting)
        const recentAttempts = await this.redisClient.get(`password_reset_attempts:${user.id}`);
        if (recentAttempts && parseInt(recentAttempts) >= 3) {
            await this.logUserActivity(
                user.id,
                'password_reset_rate_limited',
                { email, attempts: recentAttempts },
                ipAddress,
                userAgent,
                'auth-service',
                false,
                'Too many reset attempts'
            );
            
            return { success: false, error: 'Too many reset attempts. Please try again later.' };
        }

        // Generate secure reset token
        const resetToken = await this.generatePasswordResetToken(email);
        
        if (resetToken) {
            // Increment reset attempts counter
            const currentAttempts = parseInt(recentAttempts || '0') + 1;
            await this.redisClient.setEx(`password_reset_attempts:${user.id}`, 3600, currentAttempts.toString()); // 1 hour

            await this.logUserActivity(
                user.id,
                'password_reset_initiated',
                { email, resetToken: resetToken.substring(0, 8) + '...' }, // Log partial token for audit
                ipAddress,
                userAgent,
                'auth-service',
                true
            );

            return { success: true, resetToken, message: 'Password reset initiated' };
        }

        return { success: false, error: 'Failed to generate reset token' };
    }

    /**
     * Complete password reset with audit logging
     */
    async completePasswordReset(resetToken, newPassword, ipAddress = null, userAgent = null) {
        try {
            const resetData = await this.verifyPasswordResetToken(resetToken);
            
            if (!resetData) {
                await this.logUserActivity(
                    null,
                    'password_reset_invalid_token',
                    { resetToken: resetToken.substring(0, 8) + '...' },
                    ipAddress,
                    userAgent,
                    'auth-service',
                    false,
                    'Invalid or expired reset token'
                );
                
                throw new Error('Invalid or expired reset token');
            }

            // Reset password
            await this.resetPassword(resetToken, newPassword);

            // Clear reset attempts counter
            await this.redisClient.del(`password_reset_attempts:${resetData.userId}`);

            await this.logUserActivity(
                resetData.userId,
                'password_reset_completed',
                { email: resetData.email },
                ipAddress,
                userAgent,
                'auth-service',
                true
            );

            return { success: true, message: 'Password reset successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Security monitoring and alerting
     */
    async checkSecurityThreats(userId, activityType, ipAddress = null) {
        const threats = [];

        // Check for suspicious login patterns
        if (activityType === 'login_attempt') {
            // Check for multiple failed attempts from same IP
            const failedAttempts = await this.redisClient.get(`failed_attempts:${ipAddress}`);
            if (failedAttempts && parseInt(failedAttempts) >= 5) {
                threats.push({
                    type: 'brute_force_attempt',
                    severity: 'high',
                    details: { ipAddress, attempts: failedAttempts }
                });
            }

            // Check for login from new location/device
            const recentActivities = await this.dbManager.getUserActivities(userId, { 
                activityType: 'login_attempt',
                limit: 10 
            });

            const knownIPs = recentActivities
                .filter(activity => activity.success)
                .map(activity => activity.ip_address)
                .filter(ip => ip !== ipAddress);

            if (knownIPs.length > 0 && !knownIPs.includes(ipAddress)) {
                threats.push({
                    type: 'new_location_login',
                    severity: 'medium',
                    details: { ipAddress, knownIPs }
                });
            }
        }

        // Log security threats
        if (threats.length > 0) {
            await this.logUserActivity(
                userId,
                'security_threat_detected',
                { threats },
                ipAddress,
                null,
                'auth-service',
                true
            );

            // Send alerts for high severity threats
            const highSeverityThreats = threats.filter(threat => threat.severity === 'high');
            if (highSeverityThreats.length > 0) {
                await this.sendSecurityAlert(userId, highSeverityThreats);
            }
        }

        return threats;
    }

    /**
     * Send security alerts
     */
    async sendSecurityAlert(userId, threats) {
        // This would integrate with notification service
        console.log(`SECURITY ALERT for user ${userId}:`, threats);
        
        // Log the alert
        await this.logUserActivity(
            userId,
            'security_alert_sent',
            { threats },
            null,
            null,
            'auth-service',
            true
        );
    }

    /**
     * Enhanced middleware with audit logging
     */
    authenticateTokenWithAudit = async (req, res, next) => {
        const startTime = Date.now();
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');
        
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                await this.logUserActivity(
                    null,
                    'auth_token_missing',
                    { 
                        path: req.path,
                        method: req.method,
                        responseTime: Date.now() - startTime
                    },
                    ipAddress,
                    userAgent,
                    'auth-service',
                    false,
                    'Access token is required'
                );

                return res.status(401).json({
                    success: false,
                    error: 'Access token is required'
                });
            }

            // Check if token is blacklisted
            const isBlacklisted = await this.isTokenBlacklisted(token);
            if (isBlacklisted) {
                await this.logUserActivity(
                    null,
                    'auth_blacklisted_token',
                    { 
                        path: req.path,
                        method: req.method,
                        tokenPrefix: token.substring(0, 10) + '...',
                        responseTime: Date.now() - startTime
                    },
                    ipAddress,
                    userAgent,
                    'auth-service',
                    false,
                    'Token has been revoked'
                );

                return res.status(401).json({
                    success: false,
                    error: 'Token has been revoked'
                });
            }

            const decoded = this.verifyToken(token);
            if (!decoded) {
                await this.logUserActivity(
                    null,
                    'auth_invalid_token',
                    { 
                        path: req.path,
                        method: req.method,
                        tokenPrefix: token.substring(0, 10) + '...',
                        responseTime: Date.now() - startTime
                    },
                    ipAddress,
                    userAgent,
                    'auth-service',
                    false,
                    'Invalid or expired token'
                );

                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired token'
                });
            }

            // Get fresh user data
            const user = await this.getUserById(decoded.userId);
            if (!user) {
                await this.logUserActivity(
                    decoded.userId,
                    'auth_user_not_found',
                    { 
                        path: req.path,
                        method: req.method,
                        responseTime: Date.now() - startTime
                    },
                    ipAddress,
                    userAgent,
                    'auth-service',
                    false,
                    'User not found'
                );

                return res.status(401).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Log successful authentication
            await this.logUserActivity(
                user.id,
                'auth_token_validated',
                { 
                    path: req.path,
                    method: req.method,
                    responseTime: Date.now() - startTime
                },
                ipAddress,
                userAgent,
                'auth-service',
                true
            );

            req.user = user;
            next();

        } catch (error) {
            await this.logUserActivity(
                null,
                'auth_error',
                { 
                    path: req.path,
                    method: req.method,
                    error: error.message,
                    responseTime: Date.now() - startTime
                },
                ipAddress,
                userAgent,
                'auth-service',
                false,
                error.message
            );

            return res.status(401).json({
                success: false,
                error: 'Authentication error'
            });
        }
    };

    /**
     * Integration endpoints for all platforms
     */
    async validateTokenForPlatform(token, platform) {
        try {
            const decoded = this.verifyToken(token);
            if (!decoded) {
                return { success: false, error: 'Invalid token' };
            }

            const user = await this.getUserById(decoded.userId);
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            // Check platform access
            const hasAccess = user.platform_access.includes(platform) || 
                            user.platform_access.includes('all') || 
                            user.role === 'admin';

            if (!hasAccess) {
                return { success: false, error: `No access to ${platform}` };
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    platform_access: user.platform_access,
                    permissions: user.permissions
                }
            };
        } catch (error) {
            return { success: false, error: 'Token validation failed' };
        }
    }

    /**
     * Get comprehensive authentication statistics
     */
    async getAuthStatsWithSecurity() {
        const baseStats = await this.getAuthStats();
        
        // Add security-related statistics
        const securityStats = {
            failed_login_attempts_24h: 0,
            security_threats_detected_24h: 0,
            password_resets_24h: 0,
            blacklisted_tokens: 0
        };

        // Get security metrics from database
        try {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const securityQueries = [
                `SELECT COUNT(*) as count FROM user_activities 
                 WHERE activity_type = 'failed_login_attempt' AND created_at >= $1`,
                `SELECT COUNT(*) as count FROM user_activities 
                 WHERE activity_type = 'security_threat_detected' AND created_at >= $1`,
                `SELECT COUNT(*) as count FROM user_activities 
                 WHERE activity_type = 'password_reset_completed' AND created_at >= $1`
            ];

            const results = await Promise.all(
                securityQueries.map(query => this.dbManager.query(query, [yesterday]))
            );

            securityStats.failed_login_attempts_24h = parseInt(results[0].rows[0].count);
            securityStats.security_threats_detected_24h = parseInt(results[1].rows[0].count);
            securityStats.password_resets_24h = parseInt(results[2].rows[0].count);

            // Count blacklisted tokens in Redis
            const blacklistedKeys = await this.redisClient.keys('blacklist:*');
            securityStats.blacklisted_tokens = blacklistedKeys.length;

        } catch (error) {
            console.error('Failed to get security stats:', error);
        }

        return {
            ...baseStats,
            security: securityStats
        };
    }
}

module.exports = AuthService;