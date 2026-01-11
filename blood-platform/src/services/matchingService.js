const { calculateDistance } = require('../utils/helpers');

class MatchingService {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.bloodCompatibility = {
            'A+': ['A+', 'AB+'],
            'A-': ['A+', 'A-', 'AB+', 'AB-'],
            'B+': ['B+', 'AB+'],
            'B-': ['B+', 'B-', 'AB+', 'AB-'],
            'AB+': ['AB+'],
            'AB-': ['AB+', 'AB-'],
            'O+': ['A+', 'B+', 'AB+', 'O+'],
            'O-': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
        };
        
        this.urgencyWeights = {
            'critical': 1.0,
            'high': 0.8,
            'medium': 0.6,
            'low': 0.4
        };
    }

    async initialize() {
        // Initialize any required resources
        console.log('MatchingService initialized');
    }

    /**
     * Find compatible donors for a blood request
     */
    async findCompatibleDonors(bloodRequest) {
        try {
            const { blood_type, location, urgency = 'medium' } = bloodRequest;
            
            // Get compatible blood types
            const compatibleTypes = this.getCompatibleBloodTypes(blood_type);
            
            // Calculate search radius based on urgency
            const searchRadius = this.calculateSearchRadius(urgency);
            
            // Find available donors for each compatible blood type
            let allDonors = [];
            for (const donorBloodType of compatibleTypes) {
                const donors = await this.dbManager.getAvailableDonors(donorBloodType, location, searchRadius);
                allDonors = allDonors.concat(donors);
            }

            // Remove duplicates and filter by location if provided
            const uniqueDonors = this.removeDuplicateDonors(allDonors);
            
            // Score and sort donors
            const scoredDonors = uniqueDonors.map(donor => ({
                ...donor,
                compatibility_score: this.calculateCompatibilityScore(donor, bloodRequest),
                distance_km: this.calculateDistanceFromRequest(donor, bloodRequest)
            }));

            // Sort by compatibility score (highest first)
            const sortedDonors = scoredDonors.sort((a, b) => b.compatibility_score - a.compatibility_score);

            // Store matches in database for tracking
            for (const donor of sortedDonors.slice(0, 10)) { // Store top 10 matches
                await this.dbManager.createDonorMatch(
                    bloodRequest.id,
                    donor.id,
                    donor.compatibility_score,
                    donor.distance_km
                );
            }

            return sortedDonors;

        } catch (error) {
            console.error('Error finding compatible donors:', error);
            throw error;
        }
    }

    /**
     * Find donors by blood type with filters
     */
    async findDonorsByBloodType(bloodType, filters = {}) {
        const { location, radius = 50, urgency = 'medium', availability = true } = filters;
        
        try {
            return await this.dbManager.getAvailableDonors(bloodType, location, radius);
        } catch (error) {
            console.error('Error finding donors by blood type:', error);
            return [];
        }
    }

    /**
     * Get compatible blood types for donation
     */
    getCompatibleBloodTypes(recipientBloodType) {
        const compatible = [];
        
        for (const [donorType, canDonateTo] of Object.entries(this.bloodCompatibility)) {
            if (canDonateTo.includes(recipientBloodType)) {
                compatible.push(donorType);
            }
        }
        
        return compatible;
    }

    /**
     * Calculate compatibility score between donor and request
     */
    calculateCompatibilityScore(donor, request) {
        let score = 0;
        
        // Blood type compatibility (base score)
        if (this.isBloodTypeCompatible(donor.blood_type, request.blood_type)) {
            score += 100;
            
            // Perfect match bonus (same blood type)
            if (donor.blood_type === request.blood_type) {
                score += 20;
            }
        }
        
        // Distance factor (closer is better)
        const distance = this.calculateDistanceFromRequest(donor, request);
        const distanceScore = Math.max(0, 50 - (distance * 2));
        score += distanceScore;
        
        // Availability factor
        if (donor.availability) {
            score += 30;
            
            // Available until factor
            if (donor.available_until) {
                const hoursUntilUnavailable = (new Date(donor.available_until) - new Date()) / (1000 * 60 * 60);
                if (hoursUntilUnavailable > 24) {
                    score += 10; // Available for more than 24 hours
                }
            } else {
                score += 15; // No end time specified
            }
        }
        
        // Recent donation history (prefer donors who haven't donated recently)
        if (donor.last_donation_date) {
            const daysSinceLastDonation = (Date.now() - new Date(donor.last_donation_date)) / (1000 * 60 * 60 * 24);
            if (daysSinceLastDonation >= 56) { // 8 weeks minimum
                score += 20;
            } else if (daysSinceLastDonation >= 28) { // 4 weeks
                score += 10;
            }
        } else {
            score += 25; // First-time donor gets bonus
        }
        
        // Eligibility status
        if (donor.eligibility_status === 'eligible') {
            score += 15;
        }
        
        // Total donations (experience factor)
        if (donor.total_donations > 0) {
            score += Math.min(donor.total_donations * 2, 10); // Max 10 points for experience
        }
        
        // Urgency multiplier
        const urgencyMultiplier = this.urgencyWeights[request.urgency] || 0.6;
        score *= urgencyMultiplier;
        
        return Math.round(score);
    }

    /**
     * Calculate distance between donor and request location
     */
    calculateDistanceFromRequest(donor, request) {
        try {
            const donorLocation = typeof donor.location === 'string' ? JSON.parse(donor.location) : donor.location;
            const requestLocation = typeof request.location === 'string' ? JSON.parse(request.location) : request.location;
            
            return calculateDistance(
                donorLocation.lat || donorLocation.latitude,
                donorLocation.lng || donorLocation.longitude,
                requestLocation.lat || requestLocation.latitude,
                requestLocation.lng || requestLocation.longitude
            );
        } catch (error) {
            console.error('Error calculating distance:', error);
            return 999; // Return high distance on error
        }
    }

    /**
     * Remove duplicate donors from array
     */
    removeDuplicateDonors(donors) {
        const seen = new Set();
        return donors.filter(donor => {
            if (seen.has(donor.id)) {
                return false;
            }
            seen.add(donor.id);
            return true;
        });
    }

    /**
     * Check if donor blood type is compatible with recipient
     */
    isBloodTypeCompatible(donorType, recipientType) {
        return this.bloodCompatibility[donorType]?.includes(recipientType) || false;
    }

    /**
     * Calculate search radius based on urgency
     */
    calculateSearchRadius(urgency) {
        const radiusMap = {
            'critical': 200, // 200km for critical cases
            'high': 100,     // 100km for high priority
            'medium': 50,    // 50km for medium priority
            'low': 25        // 25km for low priority
        };
        
        return radiusMap[urgency] || 50;
    }

    /**
     * Calculate estimated response time
     */
    calculateEstimatedResponseTime(urgency, donorCount) {
        const baseTime = {
            'critical': 30,  // 30 minutes
            'high': 120,     // 2 hours
            'medium': 360,   // 6 hours
            'low': 720       // 12 hours
        };
        
        const base = baseTime[urgency] || 360;
        
        // Adjust based on available donors
        if (donorCount === 0) return base * 3;
        if (donorCount < 3) return base * 1.5;
        if (donorCount > 10) return base * 0.7;
        
        return base;
    }

    /**
     * Find pending requests for a specific donor
     */
    async findPendingRequestsForDonor(donorId) {
        try {
            // Get donor details first
            const donor = await this.dbManager.query('SELECT * FROM donors WHERE id = $1', [donorId]);
            if (!donor.rows.length) return [];

            const donorData = donor.rows[0];
            
            // Find requests that match donor's blood type compatibility
            const compatibleRequests = [];
            for (const [donorBloodType, canDonateTo] of Object.entries(this.bloodCompatibility)) {
                if (donorBloodType === donorData.blood_type) {
                    for (const recipientType of canDonateTo) {
                        const query = `
                            SELECT * FROM blood_requests 
                            WHERE blood_type = $1 AND status = 'pending' 
                            AND needed_by > CURRENT_TIMESTAMP
                            ORDER BY urgency DESC, created_at ASC
                        `;
                        const result = await this.dbManager.query(query, [recipientType]);
                        compatibleRequests.push(...result.rows);
                    }
                }
            }

            return this.removeDuplicateRequests(compatibleRequests);
        } catch (error) {
            console.error('Error finding pending requests for donor:', error);
            return [];
        }
    }

    /**
     * Remove duplicate requests from array
     */
    removeDuplicateRequests(requests) {
        const seen = new Set();
        return requests.filter(request => {
            if (seen.has(request.id)) {
                return false;
            }
            seen.add(request.id);
            return true;
        });
    }

    /**
     * Update matching algorithm parameters
     */
    updateMatchingParameters(params) {
        if (params.urgencyWeights) {
            this.urgencyWeights = { ...this.urgencyWeights, ...params.urgencyWeights };
        }
        
        if (params.bloodCompatibility) {
            this.bloodCompatibility = { ...this.bloodCompatibility, ...params.bloodCompatibility };
        }
    }

    /**
     * Get matching statistics
     */
    async getMatchingStatistics(timeframe = '30d') {
        try {
            const days = parseInt(timeframe.replace('d', ''));
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const queries = [
                'SELECT COUNT(*) as count FROM donor_matches WHERE created_at >= $1',
                'SELECT COUNT(*) as count FROM donations WHERE status = \'completed\' AND created_at >= $1',
                'SELECT AVG(compatibility_score) as avg_score FROM donor_matches WHERE created_at >= $1',
                `SELECT urgency, COUNT(*) as count FROM blood_requests 
                 WHERE created_at >= $1 GROUP BY urgency`
            ];

            const [matchesResult, donationsResult, avgScoreResult, urgencyResult] = await Promise.all([
                this.dbManager.query(queries[0], [startDate]),
                this.dbManager.query(queries[1], [startDate]),
                this.dbManager.query(queries[2], [startDate]),
                this.dbManager.query(queries[3], [startDate])
            ]);

            const urgencyDistribution = {};
            urgencyResult.rows.forEach(row => {
                urgencyDistribution[row.urgency] = parseInt(row.count);
            });

            return {
                total_matches: parseInt(matchesResult.rows[0].count),
                successful_donations: parseInt(donationsResult.rows[0].count),
                average_compatibility_score: parseFloat(avgScoreResult.rows[0].avg_score || 0),
                compatibility_rate: matchesResult.rows[0].count > 0 ? 
                    (donationsResult.rows[0].count / matchesResult.rows[0].count * 100).toFixed(2) : 0,
                urgency_distribution: urgencyDistribution
            };
        } catch (error) {
            console.error('Error getting matching statistics:', error);
            return {
                total_matches: 0,
                successful_donations: 0,
                average_compatibility_score: 0,
                compatibility_rate: 0,
                urgency_distribution: {
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0
                }
            };
        }
    }
}

module.exports = MatchingService;