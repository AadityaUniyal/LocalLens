/**
 * Emergency Service
 * Handles critical blood requests and emergency notifications
 */

class EmergencyService {
    constructor(dbManager, matchingService, notificationService) {
        this.dbManager = dbManager;
        this.matchingService = matchingService;
        this.notificationService = notificationService;
        this.emergencyThresholds = {
            critical_response_time: 30, // 30 minutes for critical requests
            emergency_radius: 200, // 200km search radius for emergencies
            min_donors_required: 3, // Minimum donors needed before escalation
            escalation_time: 60 // Escalate after 60 minutes with no response
        };
    }

    async initialize() {
        console.log('EmergencyService initialized');
        // Start monitoring for emergency situations
        this.startEmergencyMonitoring();
    }

    /**
     * Handle critical blood request
     */
    async handleCriticalRequest(bloodRequest) {
        try {
            console.log(`🚨 CRITICAL BLOOD REQUEST: ${bloodRequest.request_id}`);

            // Find all compatible donors within emergency radius
            const compatibleDonors = await this.matchingService.findCompatibleDonors({
                ...bloodRequest,
                urgency: 'critical'
            });

            // Send emergency notifications to all compatible donors
            if (compatibleDonors.length > 0) {
                await this.notificationService.notifyEmergencyMatch(bloodRequest, compatibleDonors);
                
                // Create emergency notification records
                for (const donor of compatibleDonors) {
                    await this.dbManager.createEmergencyNotification(
                        bloodRequest.id,
                        'donor',
                        donor.id,
                        donor.phone,
                        `EMERGENCY: ${bloodRequest.blood_type} blood urgently needed at ${bloodRequest.hospital_name}. Lives at stake!`
                    );
                }

                console.log(`🚨 Emergency alerts sent to ${compatibleDonors.length} donors`);
            } else {
                // No compatible donors found - escalate immediately
                await this.escalateEmergencyRequest(bloodRequest, 'no_compatible_donors');
            }

            // Schedule follow-up checks
            this.scheduleEmergencyFollowUp(bloodRequest.id);

            return {
                success: true,
                donors_notified: compatibleDonors.length,
                escalated: compatibleDonors.length === 0
            };

        } catch (error) {
            console.error('Error handling critical request:', error);
            throw error;
        }
    }

    /**
     * Escalate emergency request
     */
    async escalateEmergencyRequest(bloodRequest, reason) {
        try {
            console.log(`🚨 ESCALATING EMERGENCY REQUEST: ${bloodRequest.request_id} - ${reason}`);

            // Expand search radius for emergency
            const expandedDonors = await this.matchingService.findDonorsByBloodType(
                bloodRequest.blood_type,
                {
                    location: bloodRequest.location,
                    radius: this.emergencyThresholds.emergency_radius,
                    urgency: 'critical',
                    availability: true
                }
            );

            // Notify blood banks in the area
            const nearbyBloodBanks = await this.dbManager.getNearbyBloodBanks(
                bloodRequest.location,
                this.emergencyThresholds.emergency_radius
            );

            for (const bank of nearbyBloodBanks) {
                await this.dbManager.createEmergencyNotification(
                    bloodRequest.id,
                    'blood_bank',
                    bank.id,
                    bank.phone,
                    `EMERGENCY ESCALATION: ${bloodRequest.blood_type} blood urgently needed. Request ID: ${bloodRequest.request_id}`
                );
            }

            // Notify hospital authorities
            await this.dbManager.createEmergencyNotification(
                bloodRequest.id,
                'hospital',
                bloodRequest.hospital_id,
                bloodRequest.phone,
                `Emergency blood request escalated. Expanding search radius and notifying all available resources.`
            );

            // Update request priority
            await this.dbManager.query(
                'UPDATE blood_requests SET priority_score = 1000 WHERE id = $1',
                [bloodRequest.id]
            );

            return {
                success: true,
                reason,
                expanded_donors: expandedDonors.length,
                blood_banks_notified: nearbyBloodBanks.length
            };

        } catch (error) {
            console.error('Error escalating emergency request:', error);
            throw error;
        }
    }

    /**
     * Monitor emergency situations
     */
    startEmergencyMonitoring() {
        // Check for emergency situations every 5 minutes
        setInterval(async () => {
            try {
                await this.checkOverdueEmergencies();
                await this.checkLowInventoryAlerts();
                await this.processFailedNotifications();
            } catch (error) {
                console.error('Error in emergency monitoring:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes

        console.log('🚨 Emergency monitoring started');
    }

    /**
     * Check for overdue emergency requests
     */
    async checkOverdueEmergencies() {
        try {
            const overdueTime = new Date(Date.now() - this.emergencyThresholds.escalation_time * 60 * 1000);

            const overdueRequests = await this.dbManager.query(`
                SELECT * FROM blood_requests 
                WHERE urgency = 'critical' 
                AND status = 'pending' 
                AND created_at < $1
                AND priority_score < 1000
            `, [overdueTime]);

            for (const request of overdueRequests.rows) {
                console.log(`🚨 Overdue emergency request detected: ${request.request_id}`);
                await this.escalateEmergencyRequest(request, 'overdue_response');
            }

        } catch (error) {
            console.error('Error checking overdue emergencies:', error);
        }
    }

    /**
     * Check for low inventory alerts
     */
    async checkLowInventoryAlerts() {
        try {
            const bloodBanks = await this.dbManager.getAllBloodBanks();

            for (const bank of bloodBanks) {
                const inventory = await this.dbManager.getBloodInventory(bank.id);
                
                // Group by blood type
                const inventoryByType = {};
                inventory.forEach(item => {
                    if (!inventoryByType[item.blood_type]) {
                        inventoryByType[item.blood_type] = 0;
                    }
                    if (item.status === 'available') {
                        inventoryByType[item.blood_type] += item.units;
                    }
                });

                // Check for critical stock levels
                for (const [bloodType, units] of Object.entries(inventoryByType)) {
                    if (units <= 2) { // Critical threshold
                        console.log(`🚨 CRITICAL STOCK ALERT: ${bloodType} at ${bank.name} - ${units} units remaining`);
                        
                        await this.dbManager.createEmergencyNotification(
                            null, // No specific request
                            'blood_bank',
                            bank.id,
                            bank.phone,
                            `CRITICAL STOCK ALERT: Only ${units} units of ${bloodType} remaining. Immediate restocking required.`
                        );

                        // Notify compatible donors proactively
                        const compatibleDonors = await this.dbManager.getAvailableDonors(bloodType, bank.location, 50);
                        
                        for (const donor of compatibleDonors.slice(0, 10)) { // Notify top 10 donors
                            await this.dbManager.createEmergencyNotification(
                                null,
                                'donor',
                                donor.id,
                                donor.phone,
                                `Blood bank ${bank.name} has critically low ${bloodType} stock. Your donation could save lives!`
                            );
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error checking low inventory alerts:', error);
        }
    }

    /**
     * Process failed notifications and retry
     */
    async processFailedNotifications() {
        try {
            const failedNotifications = await this.dbManager.getPendingNotifications(20);

            for (const notification of failedNotifications) {
                if (notification.delivery_attempts < 3) {
                    console.log(`🔄 Retrying failed notification: ${notification.id}`);
                    
                    // Retry sending notification
                    try {
                        if (notification.recipient_type === 'donor') {
                            await this.notificationService.sendNotificationToDonor(
                                notification.recipient_id,
                                {
                                    type: 'emergency_retry',
                                    title: 'Emergency Blood Request',
                                    message: notification.message_content
                                }
                            );
                        }

                        await this.dbManager.updateNotificationStatus(notification.id, 'sent');
                    } catch (retryError) {
                        console.error(`Failed to retry notification ${notification.id}:`, retryError);
                        await this.dbManager.updateNotificationStatus(
                            notification.id, 
                            'failed', 
                            retryError.message
                        );
                    }
                } else {
                    // Mark as permanently failed after 3 attempts
                    await this.dbManager.updateNotificationStatus(
                        notification.id, 
                        'failed', 
                        'Maximum retry attempts exceeded'
                    );
                }
            }

        } catch (error) {
            console.error('Error processing failed notifications:', error);
        }
    }

    /**
     * Schedule follow-up for emergency request
     */
    scheduleEmergencyFollowUp(requestId) {
        setTimeout(async () => {
            try {
                const request = await this.dbManager.getBloodRequestById(requestId);
                
                if (request && request.status === 'pending') {
                    console.log(`🚨 Emergency follow-up for request: ${request.request_id}`);
                    
                    // Check if any donors have responded
                    const matches = await this.dbManager.getDonorMatches(requestId);
                    const respondedMatches = matches.filter(m => m.donor_response);

                    if (respondedMatches.length === 0) {
                        // No responses yet - escalate
                        await this.escalateEmergencyRequest(request, 'no_donor_response');
                    } else {
                        console.log(`✅ Emergency request ${request.request_id} has ${respondedMatches.length} responses`);
                    }
                }
            } catch (error) {
                console.error('Error in emergency follow-up:', error);
            }
        }, this.emergencyThresholds.critical_response_time * 60 * 1000); // 30 minutes
    }

    /**
     * Get emergency statistics
     */
    async getEmergencyStatistics(timeframe = '30d') {
        try {
            const days = parseInt(timeframe.replace('d', ''));
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const stats = await Promise.all([
                // Critical requests
                this.dbManager.query(`
                    SELECT COUNT(*) as count FROM blood_requests 
                    WHERE urgency = 'critical' AND created_at >= $1
                `, [startDate]),
                
                // Emergency notifications sent
                this.dbManager.query(`
                    SELECT COUNT(*) as count FROM emergency_notifications 
                    WHERE created_at >= $1
                `, [startDate]),
                
                // Average response time for critical requests
                this.dbManager.query(`
                    SELECT AVG(EXTRACT(EPOCH FROM (d.created_at - br.created_at))/60) as avg_minutes
                    FROM blood_requests br
                    JOIN donations d ON br.id = d.request_id
                    WHERE br.urgency = 'critical' AND br.created_at >= $1
                `, [startDate]),
                
                // Escalated requests
                this.dbManager.query(`
                    SELECT COUNT(*) as count FROM blood_requests 
                    WHERE urgency = 'critical' AND priority_score >= 1000 AND created_at >= $1
                `, [startDate])
            ]);

            return {
                critical_requests: parseInt(stats[0].rows[0].count),
                emergency_notifications: parseInt(stats[1].rows[0].count),
                average_response_minutes: parseFloat(stats[2].rows[0].avg_minutes || 0).toFixed(2),
                escalated_requests: parseInt(stats[3].rows[0].count),
                timeframe
            };

        } catch (error) {
            console.error('Error getting emergency statistics:', error);
            throw error;
        }
    }

    /**
     * Update emergency thresholds
     */
    updateEmergencyThresholds(newThresholds) {
        this.emergencyThresholds = { ...this.emergencyThresholds, ...newThresholds };
        console.log('🚨 Emergency thresholds updated:', this.emergencyThresholds);
    }
}

module.exports = EmergencyService;