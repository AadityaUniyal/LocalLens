/**
 * Blood Bank Inventory Service
 * Manages blood bank inventory, stock levels, and expiration tracking
 */

class InventoryService {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        this.expirationDays = 42; // Blood expires after 42 days
        this.lowStockThreshold = 5; // Alert when stock falls below 5 units
        this.criticalStockThreshold = 2; // Critical alert when stock falls below 2 units
    }

    async initialize() {
        console.log('InventoryService initialized');
    }

    /**
     * Get blood bank inventory
     */
    async getBloodBankInventory(bankId) {
        try {
            const inventory = {};
            
            // Get inventory for each blood type
            for (const bloodType of this.bloodTypes) {
                const inventoryData = await this.dbManager.getBloodInventory(bankId, bloodType);
                
                const totalUnits = inventoryData.reduce((sum, item) => sum + item.units, 0);
                const availableUnits = inventoryData
                    .filter(item => item.status === 'available')
                    .reduce((sum, item) => sum + item.units, 0);
                const reservedUnits = inventoryData
                    .filter(item => item.status === 'reserved')
                    .reduce((sum, item) => sum + item.units, 0);
                const expiredUnits = inventoryData
                    .filter(item => item.status === 'expired')
                    .reduce((sum, item) => sum + item.units, 0);
                
                // Calculate expiring soon (within 7 days)
                const expiringDate = new Date();
                expiringDate.setDate(expiringDate.getDate() + 7);
                const expiringSoon = inventoryData
                    .filter(item => item.status === 'available' && new Date(item.expiration_date) <= expiringDate)
                    .reduce((sum, item) => sum + item.units, 0);

                inventory[bloodType] = {
                    total_units: totalUnits,
                    available_units: availableUnits,
                    reserved_units: reservedUnits,
                    expired_units: expiredUnits,
                    expiring_soon: expiringSoon,
                    last_updated: new Date().toISOString(),
                    stock_status: this.getStockStatus(availableUnits)
                };
            }

            return {
                bank_id: bankId,
                inventory,
                total_units: Object.values(inventory).reduce((sum, item) => sum + item.total_units, 0),
                last_updated: new Date().toISOString(),
                alerts: this.generateInventoryAlerts(inventory)
            };

        } catch (error) {
            console.error('Error fetching blood bank inventory:', error);
            throw error;
        }
    }

    /**
     * Update inventory after donation
     */
    async updateInventoryAfterDonation(bankId, bloodType, units, donationId) {
        try {
            const donationDate = new Date();
            const expirationDate = new Date(donationDate);
            expirationDate.setDate(expirationDate.getDate() + this.expirationDays);

            const result = await this.dbManager.updateBloodInventory(bankId, bloodType, units, donationId);

            console.log(`Updated inventory: +${units} units of ${bloodType} at bank ${bankId}`);
            console.log(`Expiration date: ${expirationDate.toISOString()}`);

            return {
                success: true,
                blood_type: bloodType,
                units_added: units,
                expiration_date: expirationDate,
                updated_at: new Date().toISOString(),
                inventory_record: result
            };

        } catch (error) {
            console.error('Error updating inventory after donation:', error);
            throw error;
        }
    }

    /**
     * Reserve blood units for a request
     */
    async reserveBloodUnits(bankId, bloodType, units, requestId) {
        try {
            // Check availability
            const inventory = await this.getBloodBankInventory(bankId);
            const available = inventory.inventory[bloodType]?.available_units || 0;

            if (available < units) {
                throw new Error(`Insufficient stock: ${available} units available, ${units} requested`);
            }

            // Update inventory status to reserved
            const query = `
                UPDATE blood_inventory 
                SET status = 'reserved', updated_at = CURRENT_TIMESTAMP
                WHERE bank_id = $1 AND blood_type = $2 AND status = 'available'
                AND id IN (
                    SELECT id FROM blood_inventory 
                    WHERE bank_id = $1 AND blood_type = $2 AND status = 'available'
                    ORDER BY expiration_date ASC
                    LIMIT $3
                )
                RETURNING *
            `;

            const result = await this.dbManager.query(query, [bankId, bloodType, units]);

            console.log(`Reserved ${units} units of ${bloodType} for request ${requestId}`);

            return {
                success: true,
                reservation_id: `RES_${Date.now()}`,
                blood_type: bloodType,
                units_reserved: result.rows.length,
                bank_id: bankId,
                request_id: requestId,
                reserved_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
                reserved_items: result.rows
            };

        } catch (error) {
            console.error('Error reserving blood units:', error);
            throw error;
        }
    }

    /**
     * Release reserved blood units
     */
    async releaseReservedUnits(reservationId, bankId, bloodType, units) {
        try {
            // Update inventory status back to available
            const query = `
                UPDATE blood_inventory 
                SET status = 'available', updated_at = CURRENT_TIMESTAMP
                WHERE bank_id = $1 AND blood_type = $2 AND status = 'reserved'
                AND id IN (
                    SELECT id FROM blood_inventory 
                    WHERE bank_id = $1 AND blood_type = $2 AND status = 'reserved'
                    ORDER BY expiration_date ASC
                    LIMIT $3
                )
                RETURNING *
            `;

            const result = await this.dbManager.query(query, [bankId, bloodType, units]);

            console.log(`Released reservation ${reservationId}`);

            return {
                success: true,
                reservation_id: reservationId,
                units_released: result.rows.length,
                released_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error releasing reserved units:', error);
            throw error;
        }
    }

    /**
     * Process blood unit usage (when blood is actually used)
     */
    async processBloodUsage(bankId, bloodType, units, usageType = 'transfusion') {
        try {
            // Update inventory status to used
            const query = `
                UPDATE blood_inventory 
                SET status = 'used', updated_at = CURRENT_TIMESTAMP
                WHERE bank_id = $1 AND blood_type = $2 AND status IN ('available', 'reserved')
                AND id IN (
                    SELECT id FROM blood_inventory 
                    WHERE bank_id = $1 AND blood_type = $2 AND status IN ('available', 'reserved')
                    ORDER BY expiration_date ASC
                    LIMIT $3
                )
                RETURNING *
            `;

            const result = await this.dbManager.query(query, [bankId, bloodType, units]);

            console.log(`Processed usage: -${units} units of ${bloodType} for ${usageType}`);

            return {
                success: true,
                blood_type: bloodType,
                units_used: result.rows.length,
                usage_type: usageType,
                bank_id: bankId,
                processed_at: new Date().toISOString(),
                used_items: result.rows
            };

        } catch (error) {
            console.error('Error processing blood usage:', error);
            throw error;
        }
    }

    /**
     * Get stock status based on available units
     */
    getStockStatus(availableUnits) {
        if (availableUnits <= this.criticalStockThreshold) {
            return 'critical';
        } else if (availableUnits <= this.lowStockThreshold) {
            return 'low';
        } else if (availableUnits >= 20) {
            return 'good';
        } else {
            return 'adequate';
        }
    }

    /**
     * Generate inventory alerts
     */
    generateInventoryAlerts(inventory) {
        const alerts = [];

        for (const [bloodType, data] of Object.entries(inventory)) {
            // Low stock alerts
            if (data.available_units <= this.criticalStockThreshold) {
                alerts.push({
                    type: 'critical_stock',
                    blood_type: bloodType,
                    message: `CRITICAL: Only ${data.available_units} units of ${bloodType} remaining`,
                    priority: 'high',
                    created_at: new Date().toISOString()
                });
            } else if (data.available_units <= this.lowStockThreshold) {
                alerts.push({
                    type: 'low_stock',
                    blood_type: bloodType,
                    message: `Low stock: ${data.available_units} units of ${bloodType} remaining`,
                    priority: 'medium',
                    created_at: new Date().toISOString()
                });
            }

            // Expiration alerts
            if (data.expiring_soon > 0) {
                alerts.push({
                    type: 'expiring_soon',
                    blood_type: bloodType,
                    message: `${data.expiring_soon} units of ${bloodType} expiring within 7 days`,
                    priority: 'medium',
                    created_at: new Date().toISOString()
                });
            }
        }

        return alerts;
    }

    /**
     * Get inventory statistics
     */
    async getInventoryStatistics(bankId, timeframe = '30d') {
        try {
            const days = parseInt(timeframe.replace('d', ''));
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const queries = [
                'SELECT COUNT(*) as count FROM donations WHERE hospital_id = $1 AND status = \'completed\' AND created_at >= $2',
                'SELECT COUNT(*) as count FROM blood_inventory WHERE bank_id = $1 AND status = \'used\' AND created_at >= $2',
                'SELECT COUNT(*) as count FROM blood_inventory WHERE bank_id = $1 AND status = \'expired\' AND created_at >= $2',
                'SELECT blood_type, COUNT(*) as count FROM blood_inventory WHERE bank_id = $1 AND created_at >= $2 GROUP BY blood_type'
            ];

            const [donationsResult, usageResult, expiredResult, distributionResult] = await Promise.all([
                this.dbManager.query(queries[0], [bankId, startDate]),
                this.dbManager.query(queries[1], [bankId, startDate]),
                this.dbManager.query(queries[2], [bankId, startDate]),
                this.dbManager.query(queries[3], [bankId, startDate])
            ]);

            const bloodTypeDistribution = {};
            distributionResult.rows.forEach(row => {
                bloodTypeDistribution[row.blood_type] = {
                    percentage: '0.0', // Would calculate based on total
                    units: parseInt(row.count)
                };
            });

            const totalDonations = parseInt(donationsResult.rows[0].count);
            const totalUsage = parseInt(usageResult.rows[0].count);
            const expiredUnits = parseInt(expiredResult.rows[0].count);

            return {
                bank_id: bankId,
                timeframe,
                statistics: {
                    total_donations: totalDonations,
                    total_usage: totalUsage,
                    expired_units: expiredUnits,
                    turnover_rate: totalDonations > 0 ? (totalUsage / totalDonations).toFixed(2) : '0.00',
                    waste_percentage: totalDonations > 0 ? (expiredUnits / totalDonations * 100).toFixed(2) : '0.00',
                    blood_type_distribution: bloodTypeDistribution,
                    peak_usage_hours: ['09:00-12:00', '14:00-17:00'], // Would be calculated from actual data
                    average_stock_level: 0 // Would be calculated from inventory history
                },
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error generating inventory statistics:', error);
            throw error;
        }
    }

    /**
     * Check for expired blood units
     */
    async checkExpiredUnits(bankId) {
        try {
            const query = `
                UPDATE blood_inventory 
                SET status = 'expired', updated_at = CURRENT_TIMESTAMP
                WHERE bank_id = $1 AND status = 'available' AND expiration_date < CURRENT_DATE
                RETURNING blood_type, units, expiration_date
            `;

            const result = await this.dbManager.query(query, [bankId]);
            
            const expiredByType = {};
            result.rows.forEach(row => {
                if (!expiredByType[row.blood_type]) {
                    expiredByType[row.blood_type] = 0;
                }
                expiredByType[row.blood_type] += row.units;
            });

            const expiredUnits = Object.entries(expiredByType).map(([bloodType, units]) => ({
                blood_type: bloodType,
                units: units,
                expired_date: new Date().toISOString()
            }));

            return {
                bank_id: bankId,
                expired_units: expiredUnits,
                total_expired: expiredUnits.reduce((sum, item) => sum + item.units, 0),
                checked_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error checking expired units:', error);
            throw error;
        }
    }

    /**
     * Get inventory forecast
     */
    async getInventoryForecast(bankId, days = 7) {
        try {
            // This would use historical data and ML models in production
            // For now, providing a simple forecast based on current trends
            
            const forecast = [];
            
            for (let i = 1; i <= days; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                
                const dayForecast = {};
                for (const bloodType of this.bloodTypes) {
                    // Simple forecast logic - would be more sophisticated in production
                    const currentInventory = await this.dbManager.getBloodInventory(bankId, bloodType);
                    const currentStock = currentInventory
                        .filter(item => item.status === 'available')
                        .reduce((sum, item) => sum + item.units, 0);
                    
                    const predictedDemand = Math.floor(Math.random() * 5 + 1); // 1-5 units per day
                    const predictedStock = Math.max(0, currentStock - (predictedDemand * i));
                    
                    dayForecast[bloodType] = {
                        predicted_stock: predictedStock,
                        predicted_demand: predictedDemand,
                        recommended_action: predictedStock < this.lowStockThreshold ? 'request_donations' : 'maintain'
                    };
                }
                
                forecast.push({
                    date: date.toISOString().split('T')[0],
                    predictions: dayForecast
                });
            }

            return {
                bank_id: bankId,
                forecast_period: `${days} days`,
                forecast,
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error generating inventory forecast:', error);
            throw error;
        }
    }
}

module.exports = InventoryService;