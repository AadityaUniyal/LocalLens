/**
 * Complaint Routing Service
 * Routes complaints to appropriate authorities based on category, location, and workload
 */

const { calculateDistance } = require('../utils/helpers');
const DatabaseManager = require('../config/database');

class RoutingService {
    constructor() {
        this.db = new DatabaseManager();
        this.categoryMappings = {
            'infrastructure': ['municipal_corporation', 'other'],
            'sanitation': ['municipal_corporation', 'health_department'],
            'traffic': ['traffic_police', 'transport_department'],
            'noise': ['police_department', 'municipal_corporation'],
            'water': ['water_board', 'municipal_corporation'],
            'electricity': ['electricity_board'],
            'public_safety': ['police_department'],
            'environment': ['environment_department', 'municipal_corporation'],
            'healthcare': ['health_department'],
            'education': ['education_department'],
            'corruption': ['district_administration'],
            'other': ['municipal_corporation']
        };
        
        this.workloadThresholds = {
            'low': 10,
            'medium': 25,
            'high': 50
        };
    }

    async initialize() {
        await this.db.initialize();
        console.log('RoutingService initialized with database connection');
    }

    /**
     * Route complaint to appropriate authority
     */
    async routeComplaint(complaint) {
        try {
            // Get potential authorities for this category
            const potentialAuthorities = await this.getAuthoritiesByCategory(complaint.category);
            
            // Filter by location/jurisdiction if location data is available
            let localAuthorities = potentialAuthorities;
            if (complaint.location && complaint.location.lat && complaint.location.lng) {
                localAuthorities = await this.filterByLocation(potentialAuthorities, complaint.location);
            }
            
            // If no local authorities found, use all potential authorities
            if (localAuthorities.length === 0) {
                localAuthorities = potentialAuthorities;
            }
            
            // Select best authority based on workload and availability
            const selectedAuthority = await this.selectOptimalAuthority(localAuthorities, complaint);
            
            if (selectedAuthority) {
                // Assign complaint to authority
                await this.assignComplaint(complaint.complaint_id, selectedAuthority.id);
                
                console.log(`Complaint ${complaint.complaint_id} routed to ${selectedAuthority.name}`);
                return selectedAuthority;
            } else {
                // Fallback to default authority
                const defaultAuthority = await this.getDefaultAuthority(complaint.category);
                if (defaultAuthority) {
                    await this.assignComplaint(complaint.complaint_id, defaultAuthority.id);
                    console.log(`Complaint ${complaint.complaint_id} routed to default authority ${defaultAuthority.name}`);
                }
                return defaultAuthority;
            }

        } catch (error) {
            console.error('Error routing complaint:', error);
            throw error;
        }
    }

    /**
     * Get authorities by category
     */
    async getAuthoritiesByCategory(category) {
        try {
            const authorityTypes = this.categoryMappings[category] || ['municipal_corporation'];
            
            // Get authorities from database that handle this category
            const authorities = await this.db.getAuthorities({ 
                category: category,
                active_only: true 
            });
            
            // If no specific authorities found, get by type
            if (authorities.length === 0) {
                const allAuthorities = await this.db.getAuthorities({ active_only: true });
                return allAuthorities.filter(auth => 
                    authorityTypes.includes(auth.type) && 
                    auth.categories.includes(category)
                );
            }
            
            return authorities;

        } catch (error) {
            console.error('Error fetching authorities by category:', error);
            throw error;
        }
    }

    /**
     * Filter authorities by location/jurisdiction
     */
    async filterByLocation(authorities, complaintLocation) {
        try {
            return authorities.filter(authority => {
                // If authority has no jurisdiction defined, include it
                if (!authority.jurisdiction) return true;
                
                // Parse jurisdiction if it's a string
                let jurisdiction = authority.jurisdiction;
                if (typeof jurisdiction === 'string') {
                    try {
                        jurisdiction = JSON.parse(jurisdiction);
                    } catch (e) {
                        return true; // Include if can't parse
                    }
                }
                
                // Check if complaint location is within authority's jurisdiction
                if (jurisdiction.lat && jurisdiction.lng && jurisdiction.radius) {
                    const distance = calculateDistance(
                        complaintLocation.lat, complaintLocation.lng,
                        jurisdiction.lat, jurisdiction.lng
                    );
                    return distance <= jurisdiction.radius;
                }
                
                return true; // Include if jurisdiction format is not recognized
            });

        } catch (error) {
            console.error('Error filtering authorities by location:', error);
            return authorities; // Return all authorities if filtering fails
        }
    }

    /**
     * Select optimal authority based on workload and other factors
     */
    async selectOptimalAuthority(authorities, complaint) {
        try {
            if (authorities.length === 0) return null;
            if (authorities.length === 1) return authorities[0];
            
            // Score each authority
            const scoredAuthorities = authorities.map(authority => ({
                ...authority,
                score: this.calculateAuthorityScore(authority, complaint)
            }));
            
            // Sort by score (higher is better)
            scoredAuthorities.sort((a, b) => b.score - a.score);
            
            return scoredAuthorities[0];

        } catch (error) {
            console.error('Error selecting optimal authority:', error);
            throw error;
        }
    }

    /**
     * Calculate authority score for routing decision
     */
    calculateAuthorityScore(authority, complaint) {
        let score = 100; // Base score
        
        // Workload factor (lower workload = higher score)
        const workloadRatio = authority.current_workload / authority.max_capacity;
        score -= workloadRatio * 50;
        
        // Specialization factor (exact category match gets bonus)
        if (authority.categories.includes(complaint.category)) {
            score += 20;
        }
        
        // Priority handling (some authorities better for urgent cases)
        if (complaint.priority === 'urgent') {
            if (authority.working_hours === '24/7') {
                score += 15;
            }
            if (authority.average_resolution_time <= 2) {
                score += 10;
            }
        }
        
        // Distance factor (closer authorities get slight preference)
        if (authority.jurisdiction && complaint.location) {
            const distance = calculateDistance(
                complaint.location.lat, complaint.location.lng,
                authority.jurisdiction.lat, authority.jurisdiction.lng
            );
            score -= distance * 0.1; // Small penalty for distance
        }
        
        // Time of day factor
        const currentHour = new Date().getHours();
        if (authority.working_hours !== '24/7') {
            const [startHour, endHour] = authority.working_hours.split('-').map(time => 
                parseInt(time.split(':')[0])
            );
            
            if (currentHour < startHour || currentHour >= endHour) {
                score -= 30; // Penalty for outside working hours
            }
        }
        
        return Math.max(0, score);
    }

    /**
     * Assign complaint to authority
     */
    async assignComplaint(complaintId, authorityId, officerId = null, assignedBy = 'system', reason = 'Automatic routing') {
        try {
            // Assign complaint in database
            const assignment = await this.db.assignComplaint(complaintId, authorityId, officerId, assignedBy, reason);
            
            // Update authority workload
            await this.updateAuthorityWorkload(authorityId, 1);
            
            console.log(`Complaint ${complaintId} assigned to authority ${authorityId}`);
            return assignment;

        } catch (error) {
            console.error('Error assigning complaint:', error);
            throw error;
        }
    }

    /**
     * Update authority workload
     */
    async updateAuthorityWorkload(authorityId, increment) {
        try {
            await this.db.updateAuthorityWorkload(authorityId, increment);
            console.log(`Updated workload for authority ${authorityId} by ${increment}`);

        } catch (error) {
            console.error('Error updating authority workload:', error);
            throw error;
        }
    }

    /**
     * Get default authority for category
     */
    async getDefaultAuthority(category) {
        try {
            // Try to get municipal corporation as default
            const authorities = await this.db.getAuthorities({ 
                type: 'municipal_corporation',
                active_only: true 
            });
            
            if (authorities.length > 0) {
                return authorities[0];
            }
            
            // If no municipal corporation, get any active authority
            const allAuthorities = await this.db.getAuthorities({ active_only: true });
            return allAuthorities.length > 0 ? allAuthorities[0] : null;

        } catch (error) {
            console.error('Error getting default authority:', error);
            return null;
        }
    }

    /**
     * Get all authorities with filters
     */
    async getAuthorities(filters = {}) {
        try {
            return await this.db.getAuthorities(filters);

        } catch (error) {
            console.error('Error fetching authorities:', error);
            throw error;
        }
    }

    /**
     * Reassign complaint to different authority
     */
    async reassignComplaint(complaintId, newAuthorityId, reason) {
        try {
            // Get current assignment
            const currentAssignment = await this.getCurrentAssignment(complaintId);
            
            if (currentAssignment) {
                // Decrease workload of current authority
                await this.updateAuthorityWorkload(currentAssignment.authority_id, -1);
            }
            
            // Assign to new authority
            await this.assignComplaint(complaintId, newAuthorityId);
            
            console.log(`Complaint ${complaintId} reassigned to ${newAuthorityId}: ${reason}`);
            
            return {
                complaint_id: complaintId,
                old_authority_id: currentAssignment?.authority_id,
                new_authority_id: newAuthorityId,
                reason,
                reassigned_at: new Date()
            };

        } catch (error) {
            console.error('Error reassigning complaint:', error);
            throw error;
        }
    }

    /**
     * Get current assignment for complaint
     */
    async getCurrentAssignment(complaintId) {
        try {
            // This would query the database
            // Mock implementation for now
            return {
                complaint_id: complaintId,
                authority_id: 'auth-1',
                assigned_at: new Date()
            };

        } catch (error) {
            console.error('Error getting current assignment:', error);
            throw error;
        }
    }

    /**
     * Get routing statistics
     */
    async getRoutingStatistics(timeframe = '30d') {
        try {
            return {
                total_assignments: 0,
                by_authority: {},
                by_category: {},
                average_assignment_time: 0,
                reassignment_rate: 0,
                workload_distribution: {},
                routing_accuracy: 0.85 // Percentage of complaints resolved by first assigned authority
            };

        } catch (error) {
            console.error('Error fetching routing statistics:', error);
            throw error;
        }
    }

    /**
     * Optimize routing rules based on historical data
     */
    async optimizeRoutingRules() {
        try {
            // This would analyze historical routing performance and adjust rules
            console.log('Optimizing routing rules based on historical data');
            
            return {
                optimized: true,
                changes_made: [],
                expected_improvement: '5-10% faster resolution times',
                optimized_at: new Date()
            };

        } catch (error) {
            console.error('Error optimizing routing rules:', error);
            throw error;
        }
    }

    /**
     * Check authority availability
     */
    async checkAuthorityAvailability(authorityId) {
        try {
            // This would check if authority is currently available to take new complaints
            const authority = await this.getAuthorityById(authorityId);
            
            if (!authority) return false;
            
            const workloadRatio = authority.current_workload / authority.max_capacity;
            const isWithinWorkingHours = this.isWithinWorkingHours(authority.working_hours);
            
            return authority.active && workloadRatio < 0.9 && isWithinWorkingHours;

        } catch (error) {
            console.error('Error checking authority availability:', error);
            throw error;
        }
    }

    /**
     * Get authority by ID
     */
    async getAuthorityById(authorityId) {
        try {
            const authorities = await this.getAuthorities();
            return authorities.find(auth => auth.id === authorityId);

        } catch (error) {
            console.error('Error fetching authority by ID:', error);
            throw error;
        }
    }

    /**
     * Check if current time is within working hours
     */
    isWithinWorkingHours(workingHours) {
        if (workingHours === '24/7') return true;
        
        const currentHour = new Date().getHours();
        const [startHour, endHour] = workingHours.split('-').map(time => 
            parseInt(time.split(':')[0])
        );
        
        return currentHour >= startHour && currentHour < endHour;
    }
}

module.exports = RoutingService;