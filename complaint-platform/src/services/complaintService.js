/**
 * Complaint Management Service
 * Core business logic for complaint handling and processing
 */

const { calculateDistance, generateComplaintId } = require('../utils/helpers');
const DatabaseManager = require('../config/database');

class ComplaintService {
    constructor() {
        this.db = new DatabaseManager();
        this.priorityWeights = {
            'urgent': 1,
            'high': 3,
            'medium': 7,
            'low': 14
        };
        
        this.categoryResolutionTimes = {
            'infrastructure': 14, // days
            'sanitation': 7,
            'traffic': 3,
            'noise': 5,
            'water': 2,
            'electricity': 1,
            'public_safety': 1,
            'environment': 10,
            'healthcare': 5,
            'education': 10,
            'corruption': 21,
            'other': 7
        };
    }

    async initialize() {
        await this.db.initialize();
        console.log('ComplaintService initialized with database connection');
    }

    /**
     * Create a new complaint
     */
    async createComplaint(complaintData) {
        try {
            // Generate unique complaint ID if not provided
            if (!complaintData.complaint_id) {
                complaintData.complaint_id = generateComplaintId();
            }

            // Calculate priority if not provided
            if (!complaintData.priority) {
                complaintData.priority = this.calculatePriority(complaintData);
            }

            // Calculate urgency score
            complaintData.urgency_score = this.calculateUrgencyScore(complaintData);

            // Set default values
            const complaint = {
                ...complaintData,
                status: 'filed',
                escalation_level: 0,
                public_visibility: complaintData.public_visibility !== false,
                source: complaintData.source || 'web'
            };

            // Save to database
            const createdComplaint = await this.db.createComplaint(complaint);
            
            // Log status change
            await this.db.logStatusChange(
                complaint.complaint_id, 
                null, 
                'filed', 
                'system', 
                'Initial complaint filing'
            );

            console.log('Complaint created:', createdComplaint.complaint_id);
            return createdComplaint;

        } catch (error) {
            console.error('Error creating complaint:', error);
            throw error;
        }
    }

    /**
     * Get complaint by ID
     */
    async getComplaintById(complaintId) {
        try {
            const complaint = await this.db.getComplaintById(complaintId);
            
            if (complaint) {
                // Parse JSON fields
                complaint.location = typeof complaint.location === 'string' 
                    ? JSON.parse(complaint.location) 
                    : complaint.location;
                complaint.attachments = typeof complaint.attachments === 'string' 
                    ? JSON.parse(complaint.attachments) 
                    : complaint.attachments;
            }
            
            return complaint;

        } catch (error) {
            console.error('Error fetching complaint:', error);
            throw error;
        }
    }

    /**
     * Get complaints with filters
     */
    async getComplaints(filters = {}) {
        try {
            const result = await this.db.getComplaints(filters);
            
            // Parse JSON fields for each complaint
            result.data = result.data.map(complaint => ({
                ...complaint,
                location: typeof complaint.location === 'string' 
                    ? JSON.parse(complaint.location) 
                    : complaint.location,
                attachments: typeof complaint.attachments === 'string' 
                    ? JSON.parse(complaint.attachments) 
                    : complaint.attachments
            }));
            
            return result;

        } catch (error) {
            console.error('Error fetching complaints:', error);
            throw error;
        }
    }

    /**
     * Update complaint status
     */
    async updateComplaintStatus(complaintId, updateData) {
        try {
            // Get current complaint to track status change
            const currentComplaint = await this.getComplaintById(complaintId);
            if (!currentComplaint) {
                throw new Error('Complaint not found');
            }

            const oldStatus = currentComplaint.status;
            
            // Update complaint in database
            const updatedComplaint = await this.db.updateComplaintStatus(complaintId, updateData);
            
            // Log status change
            if (oldStatus !== updateData.status) {
                await this.db.logStatusChange(
                    complaintId,
                    oldStatus,
                    updateData.status,
                    updateData.updated_by || 'system',
                    updateData.change_reason || 'Status update',
                    updateData.resolution_notes
                );
            }

            console.log(`Complaint ${complaintId} status updated from ${oldStatus} to ${updateData.status}`);
            return updatedComplaint;

        } catch (error) {
            console.error('Error updating complaint status:', error);
            throw error;
        }
    }

    /**
     * Add comment to complaint
     */
    async addComment(complaintId, commentData) {
        try {
            const comment = await this.db.addComment(complaintId, commentData);
            console.log(`Comment added to complaint ${complaintId}`);
            return comment;

        } catch (error) {
            console.error('Error adding comment:', error);
            throw error;
        }
    }

    /**
     * Get complaints by authority
     */
    async getComplaintsByAuthority(authorityId, filters = {}) {
        try {
            const complaintFilters = {
                ...filters,
                authority_id: authorityId
            };
            
            return await this.getComplaints(complaintFilters);

        } catch (error) {
            console.error('Error fetching authority complaints:', error);
            throw error;
        }
    }

    /**
     * Get nearby complaints
     */
    async getNearbyComplaints(searchParams) {
        try {
            const { lat, lng, radius, category, status } = searchParams;
            
            // This would use geospatial queries
            // Mock implementation for now
            const mockComplaints = [];
            
            return mockComplaints.filter(complaint => {
                const distance = calculateDistance(
                    lat, lng,
                    complaint.location.lat, complaint.location.lng
                );
                
                return distance <= radius &&
                       (!category || complaint.category === category) &&
                       (!status || complaint.status === status);
            });

        } catch (error) {
            console.error('Error fetching nearby complaints:', error);
            throw error;
        }
    }

    /**
     * Add citizen feedback
     */
    async addFeedback(complaintId, feedbackData) {
        try {
            const feedback = await this.db.addFeedback(complaintId, feedbackData);
            console.log(`Feedback added for complaint ${complaintId}`);
            return feedback;

        } catch (error) {
            console.error('Error adding feedback:', error);
            throw error;
        }
    }

    /**
     * Calculate complaint priority based on category and content
     */
    calculatePriority(complaintData) {
        const { category, description, title } = complaintData;
        
        // Keywords that indicate urgency
        const urgentKeywords = [
            'emergency', 'urgent', 'immediate', 'danger', 'hazard',
            'accident', 'injury', 'fire', 'flood', 'gas leak', 'collapse',
            'explosion', 'death', 'serious', 'critical'
        ];
        
        const highKeywords = [
            'broken', 'damaged', 'not working', 'blocked', 'overflow',
            'loud', 'disturbing', 'unsafe', 'leaking', 'burst',
            'overflowing', 'contaminated', 'polluted'
        ];

        const text = `${title} ${description}`.toLowerCase();
        
        // Check for urgent keywords
        if (urgentKeywords.some(keyword => text.includes(keyword))) {
            return 'urgent';
        }
        
        // Check for high priority keywords
        if (highKeywords.some(keyword => text.includes(keyword))) {
            return 'high';
        }
        
        // Category-based priority
        const categoryPriorities = {
            'public_safety': 'high',
            'water': 'high',
            'electricity': 'high',
            'healthcare': 'high',
            'traffic': 'medium',
            'sanitation': 'medium',
            'infrastructure': 'medium',
            'corruption': 'medium',
            'noise': 'low',
            'environment': 'low',
            'education': 'low',
            'other': 'low'
        };
        
        return categoryPriorities[category] || 'medium';
    }

    /**
     * Calculate urgency score for prioritization
     */
    calculateUrgencyScore(complaintData) {
        let score = 0;
        
        // Priority-based scoring
        const priorityScores = {
            'urgent': 100,
            'high': 75,
            'medium': 50,
            'low': 25
        };
        
        score += priorityScores[complaintData.priority] || 50;
        
        // Category-based scoring
        const categoryScores = {
            'public_safety': 30,
            'water': 25,
            'electricity': 25,
            'healthcare': 30,
            'traffic': 20,
            'sanitation': 15,
            'infrastructure': 15,
            'corruption': 10,
            'noise': 5,
            'environment': 10,
            'education': 5,
            'other': 0
        };
        
        score += categoryScores[complaintData.category] || 0;
        
        // Keyword-based scoring
        const text = `${complaintData.title} ${complaintData.description}`.toLowerCase();
        const urgentKeywords = ['emergency', 'urgent', 'immediate', 'danger', 'critical'];
        const urgentMatches = urgentKeywords.filter(keyword => text.includes(keyword)).length;
        score += urgentMatches * 10;
        
        return Math.min(200, score); // Cap at 200
    }

    /**
     * Calculate estimated resolution time
     */
    calculateEstimatedResolutionTime(complaint) {
        const baseDays = this.categoryResolutionTimes[complaint.category] || 7;
        const priorityMultiplier = this.priorityWeights[complaint.priority] || 7;
        
        // Adjust based on priority
        let estimatedDays = Math.ceil(baseDays * (priorityMultiplier / 7));
        
        // Add buffer for weekends
        if (estimatedDays > 2) {
            estimatedDays += Math.ceil(estimatedDays / 5) * 2; // Add weekend days
        }
        
        const resolutionDate = new Date();
        resolutionDate.setDate(resolutionDate.getDate() + estimatedDays);
        
        return {
            estimated_days: estimatedDays,
            estimated_date: resolutionDate.toISOString(),
            confidence: this.calculateConfidence(complaint)
        };
    }

    /**
     * Calculate confidence in resolution time estimate
     */
    calculateConfidence(complaint) {
        let confidence = 0.7; // Base confidence
        
        // Adjust based on category (some are more predictable)
        const categoryConfidence = {
            'electricity': 0.9,
            'water': 0.8,
            'traffic': 0.7,
            'sanitation': 0.8,
            'infrastructure': 0.6,
            'noise': 0.5,
            'environment': 0.5,
            'public_safety': 0.8,
            'other': 0.4
        };
        
        confidence = categoryConfidence[complaint.category] || 0.7;
        
        // Adjust based on priority (urgent cases are less predictable)
        if (complaint.priority === 'urgent') {
            confidence *= 0.8;
        } else if (complaint.priority === 'low') {
            confidence *= 1.1;
        }
        
        return Math.min(0.95, Math.max(0.3, confidence));
    }

    /**
     * Get complaint statistics
     */
    async getComplaintStatistics(filters = {}) {
        try {
            return {
                total_complaints: 0,
                by_status: {
                    filed: 0,
                    acknowledged: 0,
                    in_progress: 0,
                    resolved: 0,
                    closed: 0,
                    rejected: 0
                },
                by_category: {
                    infrastructure: 0,
                    sanitation: 0,
                    traffic: 0,
                    noise: 0,
                    water: 0,
                    electricity: 0,
                    public_safety: 0,
                    environment: 0,
                    other: 0
                },
                by_priority: {
                    urgent: 0,
                    high: 0,
                    medium: 0,
                    low: 0
                },
                average_resolution_time: 0,
                resolution_rate: 0
            };

        } catch (error) {
            console.error('Error fetching complaint statistics:', error);
            throw error;
        }
    }

    /**
     * Escalate complaint if overdue
     */
    async escalateComplaint(complaintId, reason, escalatedBy = 'system') {
        try {
            const complaint = await this.getComplaintById(complaintId);
            if (!complaint) {
                throw new Error('Complaint not found');
            }

            // Determine escalation target
            const escalationTarget = await this.determineEscalationTarget(complaint);
            
            const escalationData = {
                escalated_from: complaint.assigned_authority_id,
                escalated_to: escalationTarget.id,
                reason: reason,
                type: escalatedBy === 'system' ? 'automatic' : 'manual',
                escalated_by: escalatedBy
            };

            // Escalate in database
            const escalatedComplaint = await this.db.escalateComplaint(complaintId, escalationData);
            
            console.log(`Complaint ${complaintId} escalated: ${reason}`);
            return escalatedComplaint;

        } catch (error) {
            console.error('Error escalating complaint:', error);
            throw error;
        }
    }

    /**
     * Determine escalation target based on complaint and current authority
     */
    async determineEscalationTarget(complaint) {
        try {
            // Get current authority
            const currentAuthority = complaint.assigned_authority_id 
                ? await this.db.getAuthorityById(complaint.assigned_authority_id)
                : null;

            // If there's a supervisor, escalate to them
            if (currentAuthority && currentAuthority.supervisor_id) {
                return await this.db.getAuthorityById(currentAuthority.supervisor_id);
            }

            // Otherwise, escalate to district administration
            const authorities = await this.db.getAuthorities({ type: 'district_administration' });
            if (authorities.length > 0) {
                return authorities[0];
            }

            // Fallback to municipal corporation
            const fallbackAuthorities = await this.db.getAuthorities({ type: 'municipal_corporation' });
            return fallbackAuthorities[0] || currentAuthority;

        } catch (error) {
            console.error('Error determining escalation target:', error);
            throw error;
        }
    }

    /**
     * Check for overdue complaints and auto-escalate
     */
    async checkOverdueComplaints() {
        try {
            // Get complaints that are past their estimated resolution date
            const overdueQuery = `
                SELECT * FROM complaints 
                WHERE status IN ('filed', 'acknowledged', 'assigned', 'in_progress')
                AND estimated_resolution_date < CURRENT_DATE
                AND escalation_level < 2
            `;
            
            const overdueComplaints = await this.db.getAnalyticsData(overdueQuery);
            
            for (const complaint of overdueComplaints) {
                const daysPastDue = Math.floor(
                    (new Date() - new Date(complaint.estimated_resolution_date)) / (1000 * 60 * 60 * 24)
                );
                
                await this.escalateComplaint(
                    complaint.complaint_id, 
                    `Complaint overdue by ${daysPastDue} days`,
                    'system'
                );
            }
            
            return overdueComplaints;

        } catch (error) {
            console.error('Error checking overdue complaints:', error);
            throw error;
        }
    }

    /**
     * Bulk update complaint statuses
     */
    async bulkUpdateStatus(complaintIds, status, authorityId) {
        try {
            const results = [];
            
            for (const complaintId of complaintIds) {
                const result = await this.updateComplaintStatus(complaintId, {
                    status,
                    authority_id: authorityId,
                    updated_at: new Date()
                });
                results.push(result);
            }
            
            return results;

        } catch (error) {
            console.error('Error bulk updating complaints:', error);
            throw error;
        }
    }

    /**
     * Generate complaint report
     */
    async generateReport(filters = {}) {
        try {
            const statistics = await this.getComplaintStatistics(filters);
            const complaints = await this.getComplaints(filters);
            
            return {
                generated_at: new Date().toISOString(),
                filters,
                statistics,
                complaints: complaints.data,
                summary: {
                    total_complaints: statistics.total_complaints,
                    resolution_rate: statistics.resolution_rate,
                    average_resolution_time: statistics.average_resolution_time,
                    most_common_category: this.getMostCommonCategory(statistics.by_category),
                    most_common_priority: this.getMostCommonPriority(statistics.by_priority)
                }
            };

        } catch (error) {
            console.error('Error generating report:', error);
            throw error;
        }
    }

    /**
     * Helper method to get most common category
     */
    getMostCommonCategory(categoryStats) {
        return Object.entries(categoryStats)
            .reduce((a, b) => categoryStats[a[0]] > categoryStats[b[0]] ? a : b)[0];
    }

    /**
     * Helper method to get most common priority
     */
    getMostCommonPriority(priorityStats) {
        return Object.entries(priorityStats)
            .reduce((a, b) => priorityStats[a[0]] > priorityStats[b[0]] ? a : b)[0];
    }
}

module.exports = ComplaintService;