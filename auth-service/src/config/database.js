/**
 * Database Configuration and Management
 * Handles PostgreSQL connections and user operations using schema-based separation
 */

const { NeonDatabaseManager } = require('../../../shared/database/neon-config');

class DatabaseManager extends NeonDatabaseManager {
    constructor() {
        // Initialize with auth-service for schema-based separation
        super('auth-service', {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        console.log('🔐 Auth Service using Neon main branch with auth schema');
    }

    /**
     * Initialize database tables (now handled by migrations)
     */
    async initialize() {
        try {
            await super.initialize();
            console.log('✅ Auth Service database initialized with Neon auth schema');
            return true;
        } catch (error) {
            console.error('❌ Auth Service database initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Create a new user
     */
    async createUser(userData) {
        const {
            email,
            password_hash,
            name,
            role,
            phone,
            location,
            platform_access,
            permissions
        } = userData;

        const query = `
            INSERT INTO users (email, password_hash, name, role, phone, location, platform_access, permissions)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, email, name, role, phone, location, platform_access, permissions, created_at
        `;

        const values = [
            email,
            password_hash,
            name,
            role || 'citizen',
            phone,
            location ? JSON.stringify(location) : null,
            platform_access || ['basic'],
            permissions || []
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        const query = `
            SELECT id, email, password_hash, name, role, phone, location, 
                   platform_access, permissions, email_verified, is_active, last_login, created_at,
                   mfa_enabled, mfa_secret, mfa_method, backup_codes
            FROM users 
            WHERE email = $1 AND is_active = TRUE
        `;

        const result = await this.query(query, [email]);
        return result.rows[0];
    }

    /**
     * Get user by ID
     */
    async getUserById(userId) {
        const query = `
            SELECT id, email, name, role, phone, location, 
                   platform_access, permissions, email_verified, is_active, last_login, created_at,
                   mfa_enabled, mfa_secret, mfa_method, backup_codes
            FROM users 
            WHERE id = $1 AND is_active = TRUE
        `;

        const result = await this.query(query, [userId]);
        return result.rows[0];
    }

    /**
     * Update user information
     */
    async updateUser(userId, updates) {
        const allowedFields = [
            'name', 'phone', 'location', 'platform_access', 'permissions',
            'email_verified', 'is_active', 'last_login', 
            'password_hash', 'password_changed_at', 'role',
            'mfa_enabled', 'mfa_secret', 'mfa_method', 'backup_codes'
        ];

        const updateFields = [];
        const values = [];
        let paramCount = 1;

        Object.keys(updates).forEach(field => {
            if (allowedFields.includes(field)) {
                updateFields.push(`${field} = $${paramCount}`);
                values.push(updates[field]);
                paramCount++;
            }
        });

        if (updateFields.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(userId);

        const query = `
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, email, name, role, phone, location, platform_access, permissions, updated_at
        `;

        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Get users with pagination and filtering
     */
    async getUsers(options = {}) {
        const {
            page = 1,
            limit = 20,
            role,
            search,
            isActive = true
        } = options;

        const offset = (page - 1) * limit;
        let whereConditions = ['is_active = $1'];
        let values = [isActive];
        let paramCount = 2;

        if (role) {
            whereConditions.push(`role = $${paramCount}`);
            values.push(role);
            paramCount++;
        }

        if (search) {
            whereConditions.push(`(name ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
            values.push(`%${search}%`);
            paramCount++;
        }

        const whereClause = whereConditions.join(' AND ');

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users
            WHERE ${whereClause}
        `;

        const countResult = await this.query(countQuery, values);
        const total = parseInt(countResult.rows[0].total);

        // Get users
        const query = `
            SELECT id, email, name, role, phone, platform_access, permissions,
                   email_verified, is_active, last_login, created_at
            FROM users
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

        values.push(limit, offset);

        const result = await this.query(query, values);

        return {
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Create user session
     */
    async createSession(sessionData) {
        const query = `
            INSERT INTO user_sessions (user_id, session_token, refresh_token, ip_address, user_agent, expires_at, refresh_expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, session_token, expires_at, created_at
        `;

        const values = [
            sessionData.user_id,
            sessionData.session_token,
            sessionData.refresh_token,
            sessionData.ip_address,
            sessionData.user_agent,
            sessionData.expires_at,
            sessionData.refresh_expires_at
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Get session by token
     */
    async getSessionByToken(sessionToken) {
        const query = `
            SELECT s.*, u.id as user_id, u.email, u.name, u.role, u.platform_access, u.permissions
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = $1 AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE
        `;

        const result = await this.query(query, [sessionToken]);
        return result.rows[0];
    }

    /**
     * Delete session
     */
    async deleteSession(sessionToken) {
        const query = 'DELETE FROM user_sessions WHERE session_token = $1';
        await this.query(query, [sessionToken]);
    }

    /**
     * Log user activity
     */
    async logUserActivity(userId, activityType, activityData = {}, ipAddress = null, userAgent = null, platform = null) {
        const query = `
            INSERT INTO user_activities (user_id, activity_type, activity_data, ip_address, user_agent, platform)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, created_at
        `;

        const values = [
            userId,
            activityType,
            JSON.stringify(activityData),
            ipAddress,
            userAgent,
            platform
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Get user activities
     */
    async getUserActivities(userId, options = {}) {
        const {
            page = 1,
            limit = 50,
            activityType,
            platform
        } = options;

        const offset = (page - 1) * limit;
        let whereConditions = ['user_id = $1'];
        let values = [userId];
        let paramCount = 2;

        if (activityType) {
            whereConditions.push(`activity_type = $${paramCount}`);
            values.push(activityType);
            paramCount++;
        }

        if (platform) {
            whereConditions.push(`platform = $${paramCount}`);
            values.push(platform);
            paramCount++;
        }

        const whereClause = whereConditions.join(' AND ');

        const query = `
            SELECT activity_type, activity_data, ip_address, user_agent, platform, success, error_message, created_at
            FROM user_activities
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

        values.push(limit, offset);

        const result = await this.query(query, values);
        return result.rows;
    }

    /**
     * Create password reset token
     */
    async createPasswordResetToken(userId, token, expiresAt) {
        const query = `
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, token, created_at
        `;

        const result = await this.query(query, [userId, token, expiresAt]);
        return result.rows[0];
    }

    /**
     * Get password reset token
     */
    async getPasswordResetToken(token) {
        const query = `
            SELECT prt.*, u.email, u.name
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.token = $1 AND prt.expires_at > CURRENT_TIMESTAMP AND prt.used = FALSE
        `;

        const result = await this.query(query, [token]);
        return result.rows[0];
    }

    /**
     * Mark password reset token as used
     */
    async markPasswordResetTokenUsed(token) {
        const query = `
            UPDATE password_reset_tokens 
            SET used = TRUE, used_at = CURRENT_TIMESTAMP
            WHERE token = $1
        `;

        await this.query(query, [token]);
    }

    /**
     * Clean up expired sessions and tokens
     */
    async cleanupExpiredData() {
        const queries = [
            'DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP',
            'DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP',
            `DELETE FROM user_activities WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'`
        ];

        await this.transaction(queries.map(text => ({ text, params: [] })));
    }

    /**
     * Get authentication statistics
     */
    async getAuthStats() {
        const queries = [
            'SELECT COUNT(*) as total_users FROM users WHERE is_active = TRUE',
            'SELECT COUNT(*) as active_sessions FROM user_sessions WHERE expires_at > CURRENT_TIMESTAMP',
            `SELECT 
                role, 
                COUNT(*) as count 
             FROM users 
             WHERE is_active = TRUE 
             GROUP BY role`,
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as registrations
             FROM users 
             WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date DESC`,
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as logins
             FROM user_activities 
             WHERE activity_type = 'login' 
               AND created_at >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date DESC`
        ];

        const results = await Promise.all(
            queries.map(query => this.query(query))
        );

        return {
            total_users: parseInt(results[0].rows[0].total_users),
            active_sessions: parseInt(results[1].rows[0].active_sessions),
            users_by_role: results[2].rows,
            daily_registrations: results[3].rows,
            daily_logins: results[4].rows
        };
    }
}

module.exports = DatabaseManager;