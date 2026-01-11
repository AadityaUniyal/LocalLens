/**
 * Analytics Controller
 * Business logic for analytics and reporting
 */

class AnalyticsController {
    constructor(dbManager, inventoryService, matchingService) {
        this.dbManager = dbManager;
        this.inventoryService = inventoryService;
        this.matchingService = matchingService;
    }

    /**
     * Generate comprehensive dashboard analytics
     */
    async generateDashboardAnalytics(dateRange) {
        try {
            const analytics = await this.dbManager.getDashboardAnalytics(dateRange);
            const matchingStats = await this.matchingService.getMatchingStatistics('30d');
            const bloodBanks = await this.dbManager.getAllBloodBanks();

            // Calculate additional metrics
            const responseRate = analytics.totalRequests > 0 ? 
                ((analytics.completedDonations / analytics.totalRequests) * 100).toFixed(2) : 0;

            const donorUtilizationRate = analytics.totalDonors > 0 ? 
                ((analytics.completedDonations / analytics.totalDonors) * 100).toFixed(2) : 0;

            return {
                ...analytics,
                response_rate: parseFloat(responseRate),
                donor_utilization_rate: parseFloat(donorUtilizationRate),
                matching_statistics: matchingStats,
                total_blood_banks: bloodBanks.length,
                date_range: dateRange
            };
        } catch (error) {
            console.error('Error generating dashboard analytics:', error);
            throw error;
        }
    }

    /**
     * Generate blood type distribution analytics
     */
    async generateBloodTypeDistribution(timeframe, type) {
        try {
            const days = parseInt(timeframe.replace(/\D/g, '')) || 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            let distribution = [];

            if (type === 'requests') {
                const result = await this.dbManager.query(`
                    SELECT blood_type, COUNT(*) as count, 
                           AVG(CASE WHEN urgency = 'critical' THEN 1 ELSE 0 END) * 100 as critical_percentage
                    FROM blood_requests 
                    WHERE created_at >= $1 
                    GROUP BY blood_type 
                    ORDER BY count DESC
                `, [startDate]);
                distribution = result.rows;
            } else if (type === 'donations') {
                const result = await this.dbManager.query(`
                    SELECT d.blood_type, COUNT(*) as count,
                           AVG(CASE WHEN don.status = 'completed' THEN 1 ELSE 0 END) * 100 as completion_rate
                    FROM donors d
                    JOIN donations don ON d.id = don.donor_id
                    WHERE don.created_at >= $1
                    GROUP BY d.blood_type
                    ORDER BY count DESC
                `, [startDate]);
                distribution = result.rows;
            } else if (type === 'donors') {
                const result = await this.dbManager.query(`
                    SELECT blood_type, COUNT(*) as count,
                           AVG(CASE WHEN availability = true THEN 1 ELSE 0 END) * 100 as availability_rate
                    FROM donors 
                    WHERE created_at >= $1 
                    GROUP BY blood_type 
                    ORDER BY count DESC
                `, [startDate]);
                distribution = result.rows;
            }

            return {
                distribution,
                timeframe,
                type,
                total_records: distribution.reduce((sum, item) => sum + parseInt(item.count), 0)
            };
        } catch (error) {
            console.error('Error generating blood type distribution:', error);
            throw error;
        }
    }

    /**
     * Generate performance metrics
     */
    async generatePerformanceMetrics() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const metrics = await Promise.all([
                // Success rate
                this.dbManager.query(`
                    SELECT 
                        COUNT(*) as total_requests,
                        COUNT(CASE WHEN status IN ('matched', 'fulfilled') THEN 1 END) as successful_requests
                    FROM blood_requests 
                    WHERE created_at >= $1
                `, [thirtyDaysAgo]),
                
                // Average matching time
                this.dbManager.query(`
                    SELECT AVG(EXTRACT(EPOCH FROM (dm.created_at - br.created_at))/60) as avg_matching_minutes
                    FROM blood_requests br
                    JOIN donor_matches dm ON br.id = dm.request_id
                    WHERE br.created_at >= $1
                `, [thirtyDaysAgo]),
                
                // Donor response rate
                this.dbManager.query(`
                    SELECT 
                        COUNT(*) as total_matches,
                        COUNT(CASE WHEN donor_response = 'accepted' THEN 1 END) as accepted_matches
                    FROM donor_matches 
                    WHERE created_at >= $1 AND donor_response IS NOT NULL
                `, [thirtyDaysAgo]),
                
                // Platform utilization
                this.dbManager.query(`
                    SELECT 
                        COUNT(DISTINCT donor_id) as active_donors,
                        COUNT(*) as total_donations
                    FROM donations 
                    WHERE created_at >= $1
                `, [thirtyDaysAgo])
            ]);

            const [successRate, matchingTime, responseRate, utilization] = metrics;

            return {
                success_rate: successRate.rows[0].total_requests > 0 ? 
                    ((successRate.rows[0].successful_requests / successRate.rows[0].total_requests) * 100).toFixed(2) : 0,
                average_matching_time_minutes: parseFloat(matchingTime.rows[0].avg_matching_minutes || 0).toFixed(2),
                donor_response_rate: responseRate.rows[0].total_matches > 0 ? 
                    ((responseRate.rows[0].accepted_matches / responseRate.rows[0].total_matches) * 100).toFixed(2) : 0,
                active_donors_count: parseInt(utilization.rows[0].active_donors || 0),
                total_donations_count: parseInt(utilization.rows[0].total_donations || 0),
                timeframe: '30 days'
            };
        } catch (error) {
            console.error('Error generating performance metrics:', error);
            throw error;
        }
    }

    /**
     * Generate donation trends
     */
    async generateDonationTrends(timeframe, granularity) {
        try {
            const days = parseInt(timeframe.replace(/\D/g, '')) || 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            let dateFormat;
            switch (granularity) {
                case 'weekly':
                    dateFormat = 'YYYY-"W"WW';
                    break;
                case 'monthly':
                    dateFormat = 'YYYY-MM';
                    break;
                default:
                    dateFormat = 'YYYY-MM-DD';
            }

            const query = `
                SELECT 
                    TO_CHAR(created_at, $1) as period,
                    COUNT(*) as total_donations,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_donations,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_donations,
                    COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_donations
                FROM donations 
                WHERE created_at >= $2
                GROUP BY TO_CHAR(created_at, $1)
                ORDER BY period ASC
            `;

            const result = await this.dbManager.query(query, [dateFormat, startDate]);

            return {
                trends: result.rows,
                timeframe,
                granularity,
                total_periods: result.rows.length
            };
        } catch (error) {
            console.error('Error generating donation trends:', error);
            throw error;
        }
    }

    /**
     * Generate response time analytics
     */
    async generateResponseTimeAnalytics(timeframe, urgency) {
        try {
            const days = parseInt(timeframe.replace(/\D/g, '')) || 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            let whereClause = 'WHERE br.created_at >= $1';
            const params = [startDate];

            if (urgency) {
                whereClause += ' AND br.urgency = $2';
                params.push(urgency);
            }

            const query = `
                SELECT 
                    br.urgency,
                    COUNT(*) as total_requests,
                    AVG(EXTRACT(EPOCH FROM (d.created_at - br.created_at))/3600) as avg_response_hours,
                    MIN(EXTRACT(EPOCH FROM (d.created_at - br.created_at))/3600) as min_response_hours,
                    MAX(EXTRACT(EPOCH FROM (d.created_at - br.created_at))/3600) as max_response_hours,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (d.created_at - br.created_at))/3600) as median_response_hours
                FROM blood_requests br
                LEFT JOIN donations d ON br.id = d.request_id
                ${whereClause}
                GROUP BY br.urgency
                ORDER BY 
                    CASE br.urgency 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        WHEN 'low' THEN 4 
                    END
            `;

            const result = await this.dbManager.query(query, params);

            return {
                response_times: result.rows.map(row => ({
                    ...row,
                    avg_response_hours: parseFloat(row.avg_response_hours || 0).toFixed(2),
                    min_response_hours: parseFloat(row.min_response_hours || 0).toFixed(2),
                    max_response_hours: parseFloat(row.max_response_hours || 0).toFixed(2),
                    median_response_hours: parseFloat(row.median_response_hours || 0).toFixed(2)
                })),
                timeframe,
                urgency_filter: urgency || 'all'
            };
        } catch (error) {
            console.error('Error generating response time analytics:', error);
            throw error;
        }
    }

    /**
     * Generate geographic distribution analytics
     */
    async generateGeographicDistribution(timeframe, type) {
        try {
            const days = parseInt(timeframe.replace(/\D/g, '')) || 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            let table;
            switch (type) {
                case 'donors':
                    table = 'donors';
                    break;
                case 'donations':
                    table = 'donations d JOIN donors don ON d.donor_id = don.id';
                    break;
                default:
                    table = 'blood_requests';
            }

            // Simple geographic grouping by approximate coordinates
            const result = await this.dbManager.query(`
                SELECT 
                    ROUND((location->>'lat')::numeric, 1) as lat_group,
                    ROUND((location->>'lng')::numeric, 1) as lng_group,
                    COUNT(*) as count
                FROM ${table}
                WHERE created_at >= $1
                GROUP BY lat_group, lng_group
                ORDER BY count DESC
                LIMIT 20
            `, [startDate]);

            return {
                geographic_distribution: result.rows,
                timeframe,
                type,
                total_locations: result.rows.length
            };
        } catch (error) {
            console.error('Error generating geographic distribution:', error);
            throw error;
        }
    }
}

module.exports = AnalyticsController;