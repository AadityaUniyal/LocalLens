/**
 * Complaint Platform Database Manager
 * Handles all database operations for complaint management system using schema-based separation
 */

const { NeonDatabaseManager } = require('../../../shared/database/neon-config');
const { setupLogger } = require('../utils/logger');

class DatabaseManager extends NeonDatabaseManager {
    constructor() {
        // Initialize with complaint-platform service for schema-based separation
        super('complaint-platform', {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        this.logger = setupLogger('database');
        console.log('📋 Complaint Platform using Neon main branch with complaint schema');
    }

    async initialize() {
        try {
            await super.initialize();
            this.logger.info('✅ Complaint Platform database initialized with Neon complaint schema');
            return true;
        } catch (error) {
            this.logger.error('❌ Complaint Platform database initialization failed:', error.message);
            throw error;
        }
    }

    // Complaint operations
    async createComplaint(complaintData) {
        const query = `
            INSERT INTO complaints (
                complaint_id, title, description, category, subcategory, priority, location,
                landmark, ward_number, citizen_name, citizen_email, citizen_phone, 
                citizen_address, is_anonymous, attachments, tags, source
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `;
        
        const values = [
            complaintData.complaint_id,
            complaintData.title,
            complaintData.description,
            complaintData.category,
            complaintData.subcategory,
            complaintData.priority,
            JSON.stringify(complaintData.location),
            complaintData.landmark,
            complaintData.ward_number,
            complaintData.citizen_name,
            complaintData.citizen_email,
            complaintData.citizen_phone,
            complaintData.citizen_address,
            complaintData.is_anonymous || false,
            JSON.stringify(complaintData.attachments || []),
            complaintData.tags || [],
            complaintData.source || 'web'
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    async getComplaintById(complaintId) {
        const query = 'SELECT * FROM complaints WHERE complaint_id = $1';
        const result = await this.query(query, [complaintId]);
        return result.rows[0];
    }

    async getComplaintByUUID(id) {
        const query = 'SELECT * FROM complaints WHERE id = $1';
        const result = await this.query(query, [id]);
        return result.rows[0];
    }

    async updateComplaintStatus(complaintId, updateData) {
        const query = `
            UPDATE complaints 
            SET status = $2, resolution_notes = $3, estimated_resolution_date = $4,
                actual_resolution_date = $5, updated_by = $6, updated_at = CURRENT_TIMESTAMP
            WHERE complaint_id = $1
            RETURNING *
        `;
        
        const values = [
            complaintId,
            updateData.status,
            updateData.resolution_notes,
            updateData.estimated_resolution_date,
            updateData.actual_resolution_date,
            updateData.updated_by
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    async assignComplaint(complaintId, authorityId, officerId = null, assignedBy = null, reason = null) {
        const queries = [
            {
                text: `UPDATE complaints SET assigned_authority_id = $2, assigned_officer_id = $3, 
                       status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE complaint_id = $1`,
                params: [complaintId, authorityId, officerId]
            },
            {
                text: `INSERT INTO complaint_assignments (complaint_id, authority_id, officer_id, 
                       assigned_by, assignment_reason) 
                       VALUES ((SELECT id FROM complaints WHERE complaint_id = $1), $2, $3, $4, $5)`,
                params: [complaintId, authorityId, officerId, assignedBy, reason]
            }
        ];

        await this.transaction(queries);
        return await this.getComplaintById(complaintId);
    }

    async getComplaints(filters = {}) {
        let query = 'SELECT * FROM complaints WHERE 1=1';
        const values = [];
        let paramCount = 0;

        // Apply filters
        if (filters.status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            values.push(filters.status);
        }

        if (filters.category) {
            paramCount++;
            query += ` AND category = $${paramCount}`;
            values.push(filters.category);
        }

        if (filters.priority) {
            paramCount++;
            query += ` AND priority = $${paramCount}`;
            values.push(filters.priority);
        }

        if (filters.authority_id) {
            paramCount++;
            query += ` AND assigned_authority_id = $${paramCount}`;
            values.push(filters.authority_id);
        }

        if (filters.officer_id) {
            paramCount++;
            query += ` AND assigned_officer_id = $${paramCount}`;
            values.push(filters.officer_id);
        }

        if (filters.citizen_email) {
            paramCount++;
            query += ` AND citizen_email = $${paramCount}`;
            values.push(filters.citizen_email);
        }

        if (filters.start_date) {
            paramCount++;
            query += ` AND created_at >= $${paramCount}`;
            values.push(filters.start_date);
        }

        if (filters.end_date) {
            paramCount++;
            query += ` AND created_at <= $${paramCount}`;
            values.push(filters.end_date);
        }

        if (filters.ward_number) {
            paramCount++;
            query += ` AND ward_number = $${paramCount}`;
            values.push(filters.ward_number);
        }

        query += ' ORDER BY created_at DESC';

        // Pagination
        if (filters.limit) {
            paramCount++;
            query += ` LIMIT $${paramCount}`;
            values.push(filters.limit);
        }

        if (filters.page && filters.limit) {
            paramCount++;
            const offset = (filters.page - 1) * filters.limit;
            query += ` OFFSET $${paramCount}`;
            values.push(offset);
        }

        const result = await this.query(query, values);
        
        return {
            data: result.rows,
            pagination: {
                page: filters.page || 1,
                limit: filters.limit || 20,
                total: result.rowCount
            }
        };
    }

    // Authority operations
    async createAuthority(authorityData) {
        const query = `
            INSERT INTO authorities (
                name, code, type, department, jurisdiction, contact_email, contact_phone,
                office_address, working_hours, categories, subcategories, max_capacity, 
                supervisor_id, head_officer_name, head_officer_contact
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;
        
        const values = [
            authorityData.name,
            authorityData.code,
            authorityData.type,
            authorityData.department,
            JSON.stringify(authorityData.jurisdiction),
            authorityData.contact_email,
            authorityData.contact_phone,
            authorityData.office_address,
            JSON.stringify(authorityData.working_hours),
            authorityData.categories,
            authorityData.subcategories || [],
            authorityData.max_capacity || 50,
            authorityData.supervisor_id,
            authorityData.head_officer_name,
            authorityData.head_officer_contact
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    async getAuthorities(filters = {}) {
        let query = 'SELECT * FROM authorities WHERE 1=1';
        const values = [];
        let paramCount = 0;

        if (filters.type) {
            paramCount++;
            query += ` AND type = $${paramCount}`;
            values.push(filters.type);
        }

        if (filters.category) {
            paramCount++;
            query += ` AND $${paramCount} = ANY(categories)`;
            values.push(filters.category);
        }

        if (filters.active_only !== false) {
            query += ' AND is_active = true';
        }

        query += ' ORDER BY name';

        const result = await this.query(query, values);
        return result.rows;
    }

    async getAuthorityById(authorityId) {
        const query = 'SELECT * FROM authorities WHERE id = $1';
        const result = await this.query(query, [authorityId]);
        return result.rows[0];
    }

    async updateAuthorityWorkload(authorityId, workloadChange) {
        const query = `
            UPDATE authorities 
            SET current_workload = current_workload + $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await this.query(query, [authorityId, workloadChange]);
        return result.rows[0];
    }

    // Authority officers operations
    async createAuthorityOfficer(officerData) {
        const query = `
            INSERT INTO authority_officers (
                authority_id, name, employee_id, designation, email, phone, 
                specializations, max_assignments
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const values = [
            officerData.authority_id,
            officerData.name,
            officerData.employee_id,
            officerData.designation,
            officerData.email,
            officerData.phone,
            officerData.specializations || [],
            officerData.max_assignments || 10
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    async getAuthorityOfficers(authorityId, filters = {}) {
        let query = 'SELECT * FROM authority_officers WHERE authority_id = $1';
        const values = [authorityId];
        let paramCount = 1;

        if (filters.available_only) {
            query += ' AND is_available = true AND current_assignments < max_assignments';
        }

        if (filters.specialization) {
            paramCount++;
            query += ` AND $${paramCount} = ANY(specializations)`;
            values.push(filters.specialization);
        }

        query += ' ORDER BY name';

        const result = await this.query(query, values);
        return result.rows;
    }

    // Comment operations
    async addComment(complaintId, commentData) {
        const query = `
            INSERT INTO complaint_comments (
                complaint_id, comment, author_type, author_id, author_name, 
                attachments, is_public, is_internal, parent_comment_id
            )
            VALUES ((SELECT id FROM complaints WHERE complaint_id = $1), $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        
        const values = [
            complaintId,
            commentData.comment,
            commentData.author_type,
            commentData.author_id,
            commentData.author_name,
            JSON.stringify(commentData.attachments || []),
            commentData.is_public !== false,
            commentData.is_internal || false,
            commentData.parent_comment_id
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    async getComments(complaintId, includeInternal = false) {
        let query = `
            SELECT * FROM complaint_comments 
            WHERE complaint_id = (SELECT id FROM complaints WHERE complaint_id = $1)
        `;
        
        if (!includeInternal) {
            query += ' AND is_internal = false';
        }
        
        query += ' ORDER BY created_at ASC';

        const result = await this.query(query, [complaintId]);
        return result.rows;
    }

    // Feedback operations
    async addFeedback(complaintId, feedbackData) {
        const query = `
            INSERT INTO complaint_feedback (
                complaint_id, citizen_email, rating, feedback_text, 
                feedback_categories, would_recommend, additional_suggestions
            )
            VALUES ((SELECT id FROM complaints WHERE complaint_id = $1), $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        
        const values = [
            complaintId,
            feedbackData.citizen_email,
            feedbackData.rating,
            feedbackData.feedback_text,
            feedbackData.feedback_categories || [],
            feedbackData.would_recommend,
            feedbackData.additional_suggestions
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    // Status history operations
    async logStatusChange(complaintId, oldStatus, newStatus, changedBy, reason = null, notes = null) {
        const query = `
            INSERT INTO complaint_status_history (
                complaint_id, old_status, new_status, changed_by, change_reason, additional_notes
            )
            VALUES ((SELECT id FROM complaints WHERE complaint_id = $1), $2, $3, $4, $5, $6)
            RETURNING *
        `;
        
        const result = await this.query(query, [complaintId, oldStatus, newStatus, changedBy, reason, notes]);
        return result.rows[0];
    }

    async getStatusHistory(complaintId) {
        const query = `
            SELECT * FROM complaint_status_history 
            WHERE complaint_id = (SELECT id FROM complaints WHERE complaint_id = $1)
            ORDER BY changed_at ASC
        `;
        
        const result = await this.query(query, [complaintId]);
        return result.rows;
    }

    // Escalation operations
    async escalateComplaint(complaintId, escalationData) {
        const queries = [
            {
                text: `UPDATE complaints SET escalation_level = escalation_level + 1, 
                       escalated_to = $2, escalated_at = CURRENT_TIMESTAMP, escalation_reason = $3,
                       status = 'escalated', updated_at = CURRENT_TIMESTAMP
                       WHERE complaint_id = $1`,
                params: [complaintId, escalationData.escalated_to, escalationData.reason]
            },
            {
                text: `INSERT INTO complaint_escalations (
                       complaint_id, escalated_from, escalated_to, escalation_level, 
                       escalation_reason, escalation_type, escalated_by
                       ) VALUES (
                       (SELECT id FROM complaints WHERE complaint_id = $1), $2, $3, 
                       (SELECT escalation_level FROM complaints WHERE complaint_id = $1), $4, $5, $6
                       )`,
                params: [
                    complaintId, 
                    escalationData.escalated_from, 
                    escalationData.escalated_to,
                    escalationData.reason,
                    escalationData.type || 'manual',
                    escalationData.escalated_by
                ]
            }
        ];

        await this.transaction(queries);
        return await this.getComplaintById(complaintId);
    }

    // Notification operations
    async createNotification(notificationData) {
        const query = `
            INSERT INTO notifications (
                recipient_type, recipient_id, notification_type, title, message, 
                data, channels, priority, scheduled_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        
        const values = [
            notificationData.recipient_type,
            notificationData.recipient_id,
            notificationData.notification_type,
            notificationData.title,
            notificationData.message,
            JSON.stringify(notificationData.data || {}),
            notificationData.channels || ['email'],
            notificationData.priority || 'normal',
            notificationData.scheduled_at
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    async updateNotificationStatus(notificationId, status, errorMessage = null) {
        const query = `
            UPDATE notifications 
            SET delivery_status = $2, sent_at = CURRENT_TIMESTAMP, error_message = $3,
                delivery_attempts = delivery_attempts + 1
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await this.query(query, [notificationId, status, errorMessage]);
        return result.rows[0];
    }

    async getNotifications(recipientType, recipientId, filters = {}) {
        let query = 'SELECT * FROM notifications WHERE recipient_type = $1 AND recipient_id = $2';
        const values = [recipientType, recipientId];
        let paramCount = 2;

        if (filters.unread_only) {
            query += ' AND read_at IS NULL';
        }

        if (filters.priority) {
            paramCount++;
            query += ` AND priority = $${paramCount}`;
            values.push(filters.priority);
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            paramCount++;
            query += ` LIMIT $${paramCount}`;
            values.push(filters.limit);
        }

        const result = await this.query(query, values);
        return result.rows;
    }

    // Analytics operations
    async getAnalyticsData(query, params = []) {
        const result = await this.query(query, params);
        return result.rows;
    }

    async cacheAnalytics(cacheKey, data, expiresIn = 300) {
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        
        const query = `
            INSERT INTO complaint_analytics (metric_type, metric_date, value, metadata)
            VALUES ($1, CURRENT_DATE, 0, $2)
            ON CONFLICT (metric_type, metric_date, category, authority_id, region) 
            DO UPDATE SET metadata = $2, created_at = CURRENT_TIMESTAMP
        `;
        
        await this.query(query, [cacheKey, JSON.stringify({ data, expires_at: expiresAt })]);
    }

    async getCachedAnalytics(cacheKey) {
        const query = `
            SELECT metadata FROM complaint_analytics 
            WHERE metric_type = $1 
            AND (metadata->>'expires_at')::timestamp > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const result = await this.query(query, [cacheKey]);
        if (result.rows[0]) {
            const metadata = result.rows[0].metadata;
            return metadata.data;
        }
        return null;
    }

    // File attachment operations
    async addFileAttachment(complaintId, commentId, fileData) {
        const query = `
            INSERT INTO file_attachments (
                complaint_id, comment_id, filename, original_filename, 
                file_path, file_size, mime_type, file_hash, uploaded_by, is_public
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        
        const values = [
            complaintId ? (await this.query('SELECT id FROM complaints WHERE complaint_id = $1', [complaintId])).rows[0]?.id : null,
            commentId,
            fileData.filename,
            fileData.original_filename,
            fileData.file_path,
            fileData.file_size,
            fileData.mime_type,
            fileData.file_hash,
            fileData.uploaded_by,
            fileData.is_public !== false
        ];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    async getFileAttachments(complaintId) {
        const query = `
            SELECT * FROM file_attachments 
            WHERE complaint_id = (SELECT id FROM complaints WHERE complaint_id = $1)
            ORDER BY created_at ASC
        `;
        
        const result = await this.query(query, [complaintId]);
        return result.rows;
    }
}

module.exports = DatabaseManager;