/**
 * Analytics Routes
 * API endpoints for blood platform analytics and reporting
 */

const express = require('express');
const { query, validationResult } = require('express-validator');
const router = express.Router();

// Import services (will be injected by main app)
let dbManager, inventoryService, matchingService;

// Initialize services
function initializeServices(services) {
    dbManager = services.dbManager;
    inventoryService = services.inventoryService;
    matchingService = services.matchingService;
}

// Get dashboard analytics
router.get('/dashboard', [
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date parameters',
                details: errors.array()
            });
        }

        const { start_date, end_date } = req.query;
        
        const dateRange = {
            start_date: start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end_date: end_date ? new Date(end_date) : new Date()
        };

        // Get basic analytics
        const analytics = await dbManager.getDashboardAnalytics(dateRange);

        // Get matching statistics
        const matchingStats = await matchingService.getMatchingStatistics('30d');

        // Get blood banks
        const bloodBanks = await dbManager.getAllBloodBanks();

        // Calculate additional metrics
        const responseRate = analytics.totalRequests > 0 ? 
            ((analytics.completedDonations / analytics.totalRequests) * 100).toFixed(2) : 0;

        const donorUtilizationRate = analytics.totalDonors > 0 ? 
            ((analytics.completedDonations / analytics.totalDonors) * 100).toFixed(2) : 0;

        res.json({
            success: true,
            analytics: {
                ...analytics,
                response_rate: parseFloat(responseRate),
                donor_utilization_rate: parseFloat(donorUtilizationRate),
                matching_statistics: matchingStats,
                total_blood_banks: bloodBanks.length,
                date_range: dateRange
            }
        });

    } catch (error) {
        console.error('Analytics fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get blood type distribution analytics
router.get('/blood-type-distribution', [
    query('timeframe').optional().isIn(['7d', '30d', '90d', '1y']),
    query('type').optional().isIn(['requests', 'donations', 'donors'])
], async (req, res) => {
    try {
        const { timeframe = '30d', type = 'requests' } = req.query;
        
        const days = parseInt(timeframe.replace(/\D/g, '')) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        let distribution = [];

        if (type === 'requests') {
            const result = await dbManager.query(`
                SELECT blood_type, COUNT(*) as count, 
                       AVG(CASE WHEN urgency = 'critical' THEN 1 ELSE 0 END) * 100 as critical_percentage
                FROM blood_requests 
                WHERE created_at >= $1 
                GROUP BY blood_type 
                ORDER BY count DESC
            `, [startDate]);
            distribution = result.rows;
        } else if (type === 'donations') {
            const result = await dbManager.query(`
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
            const result = await dbManager.query(`
                SELECT blood_type, COUNT(*) as count,
                       AVG(CASE WHEN availability = true THEN 1 ELSE 0 END) * 100 as availability_rate
                FROM donors 
                WHERE created_at >= $1 
                GROUP BY blood_type 
                ORDER BY count DESC
            `, [startDate]);
            distribution = result.rows;
        }

        res.json({
            success: true,
            distribution,
            timeframe,
            type,
            total_records: distribution.reduce((sum, item) => sum + parseInt(item.count), 0)
        });

    } catch (error) {
        console.error('Blood type distribution error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get inventory analytics
router.get('/inventory', [
    query('bank_id').optional().isUUID()
], async (req, res) => {
    try {
        const { bank_id } = req.query;

        if (bank_id) {
            // Get specific bank inventory
            const inventory = await inventoryService.getBloodBankInventory(bank_id);
            const statistics = await inventoryService.getInventoryStatistics(bank_id, '30d');

            res.json({
                success: true,
                bank_inventory: inventory,
                statistics
            });
        } else {
            // Get all banks inventory summary
            const bloodBanks = await dbManager.getAllBloodBanks();
            const inventorySummary = [];

            for (const bank of bloodBanks) {
                const inventory = await inventoryService.getBloodBankInventory(bank.id);
                inventorySummary.push({
                    bank_id: bank.id,
                    bank_name: bank.name,
                    inventory: inventory.inventory,
                    total_units: inventory.total_units,
                    alerts: inventory.alerts
                });
            }

            res.json({
                success: true,
                inventory_summary: inventorySummary,
                total_banks: bloodBanks.length
            });
        }

    } catch (error) {
        console.error('Inventory analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get donation trends
router.get('/donation-trends', [
    query('timeframe').optional().isIn(['7d', '30d', '90d', '1y']),
    query('granularity').optional().isIn(['daily', 'weekly', 'monthly'])
], async (req, res) => {
    try {
        const { timeframe = '30d', granularity = 'daily' } = req.query;
        
        const days = parseInt(timeframe.replace(/\D/g, '')) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        let dateFormat, dateInterval;
        switch (granularity) {
            case 'weekly':
                dateFormat = 'YYYY-"W"WW';
                dateInterval = '1 week';
                break;
            case 'monthly':
                dateFormat = 'YYYY-MM';
                dateInterval = '1 month';
                break;
            default:
                dateFormat = 'YYYY-MM-DD';
                dateInterval = '1 day';
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

        const result = await dbManager.query(query, [dateFormat, startDate]);

        res.json({
            success: true,
            trends: result.rows,
            timeframe,
            granularity,
            total_periods: result.rows.length
        });

    } catch (error) {
        console.error('Donation trends error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get response time analytics
router.get('/response-times', [
    query('timeframe').optional().isIn(['7d', '30d', '90d']),
    query('urgency').optional().isIn(['low', 'medium', 'high', 'critical'])
], async (req, res) => {
    try {
        const { timeframe = '30d', urgency } = req.query;
        
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

        const result = await dbManager.query(query, params);

        res.json({
            success: true,
            response_times: result.rows.map(row => ({
                ...row,
                avg_response_hours: parseFloat(row.avg_response_hours || 0).toFixed(2),
                min_response_hours: parseFloat(row.min_response_hours || 0).toFixed(2),
                max_response_hours: parseFloat(row.max_response_hours || 0).toFixed(2),
                median_response_hours: parseFloat(row.median_response_hours || 0).toFixed(2)
            })),
            timeframe,
            urgency_filter: urgency || 'all'
        });

    } catch (error) {
        console.error('Response times analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get geographic distribution
router.get('/geographic-distribution', [
    query('timeframe').optional().isIn(['7d', '30d', '90d', '1y']),
    query('type').optional().isIn(['requests', 'donors', 'donations'])
], async (req, res) => {
    try {
        const { timeframe = '30d', type = 'requests' } = req.query;
        
        const days = parseInt(timeframe.replace(/\D/g, '')) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // This is a simplified geographic analysis
        // In production, you'd use PostGIS for proper geospatial analysis
        let query, table;
        
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
        const result = await dbManager.query(`
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

        res.json({
            success: true,
            geographic_distribution: result.rows,
            timeframe,
            type,
            total_locations: result.rows.length
        });

    } catch (error) {
        console.error('Geographic distribution error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const metrics = await Promise.all([
            // Success rate
            dbManager.query(`
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN status IN ('matched', 'fulfilled') THEN 1 END) as successful_requests
                FROM blood_requests 
                WHERE created_at >= $1
            `, [thirtyDaysAgo]),
            
            // Average matching time
            dbManager.query(`
                SELECT AVG(EXTRACT(EPOCH FROM (dm.created_at - br.created_at))/60) as avg_matching_minutes
                FROM blood_requests br
                JOIN donor_matches dm ON br.id = dm.request_id
                WHERE br.created_at >= $1
            `, [thirtyDaysAgo]),
            
            // Donor response rate
            dbManager.query(`
                SELECT 
                    COUNT(*) as total_matches,
                    COUNT(CASE WHEN donor_response = 'accepted' THEN 1 END) as accepted_matches
                FROM donor_matches 
                WHERE created_at >= $1 AND donor_response IS NOT NULL
            `, [thirtyDaysAgo]),
            
            // Platform utilization
            dbManager.query(`
                SELECT 
                    COUNT(DISTINCT donor_id) as active_donors,
                    COUNT(*) as total_donations
                FROM donations 
                WHERE created_at >= $1
            `, [thirtyDaysAgo])
        ]);

        const [successRate, matchingTime, responseRate, utilization] = metrics;

        const performance = {
            success_rate: successRate.rows[0].total_requests > 0 ? 
                ((successRate.rows[0].successful_requests / successRate.rows[0].total_requests) * 100).toFixed(2) : 0,
            average_matching_time_minutes: parseFloat(matchingTime.rows[0].avg_matching_minutes || 0).toFixed(2),
            donor_response_rate: responseRate.rows[0].total_matches > 0 ? 
                ((responseRate.rows[0].accepted_matches / responseRate.rows[0].total_matches) * 100).toFixed(2) : 0,
            active_donors_count: parseInt(utilization.rows[0].active_donors || 0),
            total_donations_count: parseInt(utilization.rows[0].total_donations || 0),
            timeframe: '30 days'
        };

        res.json({
            success: true,
            performance
        });

    } catch (error) {
        console.error('Performance metrics error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = { router, initializeServices };