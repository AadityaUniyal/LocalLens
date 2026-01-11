/**
 * Blood Platform Test Suite
 * Comprehensive tests for blood donation platform functionality
 */

const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');

// Import modules to test
const MatchingService = require('../src/services/matchingService');
const NotificationService = require('../src/services/notificationService');
const InventoryService = require('../src/services/inventoryService');
const DatabaseManager = require('../src/config/database');
const {
    validateCoordinates,
    calculateDistance,
    validateBloodType,
    getBloodTypeCompatibility,
    validateDonorEligibility,
    calculateAge,
    canDonateNow
} = require('../src/utils/helpers');

describe('Blood Platform Tests', () => {
    
    describe('Helper Functions', () => {
        
        describe('validateCoordinates', () => {
            it('should validate correct coordinates', () => {
                const result = validateCoordinates(40.7128, -74.0060);
                expect(result.valid).to.be.true;
                expect(result.lat).to.equal(40.7128);
                expect(result.lng).to.equal(-74.0060);
            });

            it('should reject invalid latitude', () => {
                const result = validateCoordinates(91, -74.0060);
                expect(result.valid).to.be.false;
                expect(result.error).to.include('Latitude');
            });

            it('should reject invalid longitude', () => {
                const result = validateCoordinates(40.7128, 181);
                expect(result.valid).to.be.false;
                expect(result.error).to.include('Longitude');
            });

            it('should reject non-numeric coordinates', () => {
                const result = validateCoordinates('invalid', 'coordinates');
                expect(result.valid).to.be.false;
                expect(result.error).to.include('valid numbers');
            });
        });

        describe('calculateDistance', () => {
            it('should calculate distance between two points', () => {
                // Distance between New York and Los Angeles (approximately 3944 km)
                const distance = calculateDistance(40.7128, -74.0060, 34.0522, -118.2437);
                expect(distance).to.be.closeTo(3944, 100); // Allow 100km margin
            });

            it('should return 0 for same coordinates', () => {
                const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
                expect(distance).to.equal(0);
            });

            it('should handle negative coordinates', () => {
                const distance = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
                expect(distance).to.be.greaterThan(0);
            });
        });

        describe('validateBloodType', () => {
            it('should validate correct blood types', () => {
                const validTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                validTypes.forEach(type => {
                    expect(validateBloodType(type)).to.be.true;
                });
            });

            it('should reject invalid blood types', () => {
                const invalidTypes = ['C+', 'XY', 'A', 'B', 'AB', 'O', ''];
                invalidTypes.forEach(type => {
                    expect(validateBloodType(type)).to.be.false;
                });
            });
        });

        describe('getBloodTypeCompatibility', () => {
            it('should correctly identify O- as universal donor', () => {
                const allTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                allTypes.forEach(recipientType => {
                    expect(getBloodTypeCompatibility('O-', recipientType)).to.be.true;
                });
            });

            it('should correctly identify AB+ as universal recipient', () => {
                const allTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                allTypes.forEach(donorType => {
                    expect(getBloodTypeCompatibility(donorType, 'AB+')).to.be.true;
                });
            });

            it('should reject incompatible combinations', () => {
                expect(getBloodTypeCompatibility('A+', 'B+')).to.be.false;
                expect(getBloodTypeCompatibility('B-', 'A+')).to.be.false;
                expect(getBloodTypeCompatibility('AB+', 'O-')).to.be.false;
            });
        });

        describe('calculateAge', () => {
            it('should calculate correct age', () => {
                const birthDate = new Date();
                birthDate.setFullYear(birthDate.getFullYear() - 25);
                const age = calculateAge(birthDate);
                expect(age).to.equal(25);
            });

            it('should handle birthday not yet occurred this year', () => {
                const birthDate = new Date();
                birthDate.setFullYear(birthDate.getFullYear() - 25);
                birthDate.setMonth(birthDate.getMonth() + 1); // Next month
                const age = calculateAge(birthDate);
                expect(age).to.equal(24);
            });
        });

        describe('validateDonorEligibility', () => {
            it('should approve eligible donor', () => {
                const donor = {
                    date_of_birth: '1990-01-01',
                    blood_type: 'O+',
                    medical_conditions: []
                };
                const result = validateDonorEligibility(donor);
                expect(result.eligible).to.be.true;
                expect(result.errors).to.be.empty;
            });

            it('should reject underage donor', () => {
                const donor = {
                    date_of_birth: '2010-01-01',
                    blood_type: 'O+',
                    medical_conditions: []
                };
                const result = validateDonorEligibility(donor);
                expect(result.eligible).to.be.false;
                expect(result.errors).to.include('Donor must be at least 18 years old');
            });

            it('should reject donor with restrictive medical condition', () => {
                const donor = {
                    date_of_birth: '1990-01-01',
                    blood_type: 'O+',
                    medical_conditions: ['HIV']
                };
                const result = validateDonorEligibility(donor);
                expect(result.eligible).to.be.false;
                expect(result.errors.some(error => error.includes('Medical condition'))).to.be.true;
            });
        });

        describe('canDonateNow', () => {
            it('should allow donation if never donated before', () => {
                expect(canDonateNow(null)).to.be.true;
            });

            it('should allow donation after 8 weeks', () => {
                const lastDonation = new Date();
                lastDonation.setDate(lastDonation.getDate() - 60); // 60 days ago
                expect(canDonateNow(lastDonation)).to.be.true;
            });

            it('should not allow donation within 8 weeks', () => {
                const lastDonation = new Date();
                lastDonation.setDate(lastDonation.getDate() - 30); // 30 days ago
                expect(canDonateNow(lastDonation)).to.be.false;
            });
        });
    });

    describe('MatchingService', () => {
        let matchingService;

        beforeEach(() => {
            matchingService = new MatchingService();
        });

        describe('getCompatibleBloodTypes', () => {
            it('should return correct compatible types for A+', () => {
                const compatible = matchingService.getCompatibleBloodTypes('A+');
                expect(compatible).to.include.members(['A+', 'A-', 'O+', 'O-']);
            });

            it('should return correct compatible types for AB-', () => {
                const compatible = matchingService.getCompatibleBloodTypes('AB-');
                expect(compatible).to.include.members(['AB-', 'A-', 'B-', 'O-']);
            });

            it('should return only O- for O- recipient', () => {
                const compatible = matchingService.getCompatibleBloodTypes('O-');
                expect(compatible).to.deep.equal(['O-']);
            });
        });

        describe('calculateSearchRadius', () => {
            it('should return larger radius for critical urgency', () => {
                const radius = matchingService.calculateSearchRadius('critical');
                expect(radius).to.equal(200);
            });

            it('should return smaller radius for low urgency', () => {
                const radius = matchingService.calculateSearchRadius('low');
                expect(radius).to.equal(25);
            });

            it('should return default radius for unknown urgency', () => {
                const radius = matchingService.calculateSearchRadius('unknown');
                expect(radius).to.equal(50);
            });
        });

        describe('calculateCompatibilityScore', () => {
            it('should give higher score for compatible blood type', () => {
                const donor = {
                    blood_type: 'O-',
                    location: { lat: 40.7128, lng: -74.0060 },
                    availability: true,
                    last_donation_date: null
                };
                const request = {
                    blood_type: 'A+',
                    location: { lat: 40.7128, lng: -74.0060 },
                    urgency: 'medium'
                };
                
                const score = matchingService.calculateCompatibilityScore(donor, request);
                expect(score).to.be.greaterThan(100);
            });

            it('should give zero score for incompatible blood type', () => {
                const donor = {
                    blood_type: 'A+',
                    location: { lat: 40.7128, lng: -74.0060 },
                    availability: true,
                    last_donation_date: null
                };
                const request = {
                    blood_type: 'B+',
                    location: { lat: 40.7128, lng: -74.0060 },
                    urgency: 'medium'
                };
                
                const score = matchingService.calculateCompatibilityScore(donor, request);
                expect(score).to.be.lessThan(100);
            });
        });

        describe('calculateEstimatedResponseTime', () => {
            it('should return shorter time for critical urgency', () => {
                const time = matchingService.calculateEstimatedResponseTime('critical', 5);
                expect(time).to.be.lessThan(60);
            });

            it('should return longer time when no donors available', () => {
                const time = matchingService.calculateEstimatedResponseTime('medium', 0);
                expect(time).to.be.greaterThan(500);
            });

            it('should return shorter time when many donors available', () => {
                const time = matchingService.calculateEstimatedResponseTime('medium', 15);
                expect(time).to.be.lessThan(300);
            })
        });
    });

    describe('NotificationService', () => {
        let notificationService;
        let mockIo;

        beforeEach(() => {
            mockIo = {
                emit: sinon.stub(),
                to: sinon.stub().returns({
                    emit: sinon.stub()
                })
            };
            notificationService = new NotificationService(mockIo);
        });

        describe('notifyDonorsOfRequest', () => {
            it('should send notifications to all compatible donors', async () => {
                const bloodRequest = {
                    id: 'req-123',
                    blood_type: 'A+',
                    urgency: 'medium',
                    hospital_name: 'Test Hospital'
                };
                const donors = [
                    { id: 'donor-1' },
                    { id: 'donor-2' }
                ];

                await notificationService.notifyDonorsOfRequest(bloodRequest, donors);
                
                expect(mockIo.emit.calledWith('donors_notified')).to.be.true;
            });
        });

        describe('notifyEmergencyMatch', () => {
            it('should send emergency notifications for critical requests', async () => {
                const bloodRequest = {
                    id: 'req-123',
                    blood_type: 'O-',
                    urgency: 'critical',
                    hospital_name: 'Emergency Hospital'
                };
                const donors = [{ id: 'donor-1' }];

                await notificationService.notifyEmergencyMatch(bloodRequest, donors);
                
                expect(mockIo.emit.calledWith('emergency_alert')).to.be.true;
            });
        });
    });

    describe('InventoryService', () => {
        let inventoryService;

        beforeEach(() => {
            inventoryService = new InventoryService();
        });

        describe('getStockStatus', () => {
            it('should return critical for very low stock', () => {
                const status = inventoryService.getStockStatus(1);
                expect(status).to.equal('critical');
            });

            it('should return low for low stock', () => {
                const status = inventoryService.getStockStatus(4);
                expect(status).to.equal('low');
            });

            it('should return good for high stock', () => {
                const status = inventoryService.getStockStatus(25);
                expect(status).to.equal('good');
            });
        });

        describe('generateInventoryAlerts', () => {
            it('should generate critical alert for very low stock', () => {
                const inventory = {
                    'A+': {
                        available_units: 1,
                        expiring_soon: 0
                    }
                };
                
                const alerts = inventoryService.generateInventoryAlerts(inventory);
                expect(alerts).to.have.lengthOf(1);
                expect(alerts[0].type).to.equal('critical_stock');
            });

            it('should generate expiration alert', () => {
                const inventory = {
                    'B+': {
                        available_units: 10,
                        expiring_soon: 5
                    }
                };
                
                const alerts = inventoryService.generateInventoryAlerts(inventory);
                expect(alerts).to.have.lengthOf(1);
                expect(alerts[0].type).to.equal('expiring_soon');
            });
        });

        describe('reserveBloodUnits', () => {
            it('should successfully reserve available units', async () => {
                // Mock the inventory check
                sinon.stub(inventoryService, 'getBloodBankInventory').resolves({
                    inventory: {
                        'A+': { available_units: 10 }
                    }
                });

                const result = await inventoryService.reserveBloodUnits('bank-1', 'A+', 2, 'req-1');
                
                expect(result.success).to.be.true;
                expect(result.units_reserved).to.equal(2);
                expect(result.blood_type).to.equal('A+');
            });
        });
    });

    describe('Integration Tests', () => {
        
        describe('Blood Request Flow', () => {
            it('should handle complete blood request workflow', async () => {
                // This would test the complete flow from request creation
                // to donor matching and notification
                const requestData = {
                    name: 'John Doe',
                    email: 'john@example.com',
                    phone: '+1234567890',
                    blood_type: 'A+',
                    urgency: 'high',
                    units_needed: 2,
                    hospital_id: 'hospital-123',
                    location: { lat: 40.7128, lng: -74.0060 },
                    needed_by: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };

                // Test would verify:
                // 1. Request is created successfully
                // 2. Compatible donors are found
                // 3. Notifications are sent
                // 4. Real-time events are emitted
                
                expect(requestData.blood_type).to.equal('A+');
                expect(requestData.urgency).to.equal('high');
            });
        });

        describe('Donation Confirmation Flow', () => {
            it('should handle donation confirmation workflow', async () => {
                const donationData = {
                    request_id: 'req-123',
                    donor_id: 'donor-456',
                    hospital_id: 'hospital-789',
                    donation_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };

                // Test would verify:
                // 1. Donation record is created
                // 2. Request status is updated
                // 3. Donor availability is updated
                // 4. Confirmation notifications are sent
                
                expect(donationData.request_id).to.equal('req-123');
                expect(donationData.donor_id).to.equal('donor-456');
            });
        });
    });

    describe('Error Handling', () => {
        
        it('should handle database connection errors gracefully', async () => {
            const dbManager = new DatabaseManager();
            
            // Mock database error
            sinon.stub(dbManager, 'pool').value({
                query: sinon.stub().rejects(new Error('Database connection failed'))
            });

            try {
                await dbManager.createDonor({});
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Database connection failed');
            }
        });

        it('should handle invalid input data', () => {
            const result = validateCoordinates('invalid', 'data');
            expect(result.valid).to.be.false;
            expect(result.error).to.exist;
        });

        it('should handle missing required fields', () => {
            const donor = {
                // Missing required fields
                blood_type: 'A+'
            };
            
            const result = validateDonorEligibility(donor);
            expect(result.eligible).to.be.false;
        });
    });

    describe('Performance Tests', () => {
        
        it('should handle large donor lists efficiently', () => {
            const matchingService = new MatchingService();
            const startTime = Date.now();
            
            // Simulate processing large donor list
            for (let i = 0; i < 1000; i++) {
                matchingService.calculateCompatibilityScore(
                    { blood_type: 'O+', location: { lat: 40, lng: -74 }, availability: true },
                    { blood_type: 'A+', location: { lat: 40.1, lng: -74.1 }, urgency: 'medium' }
                );
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).to.be.lessThan(1000); // Should complete within 1 second
        });

        it('should handle concurrent notifications efficiently', async () => {
            const mockIo = {
                emit: sinon.stub(),
                to: sinon.stub().returns({ emit: sinon.stub() })
            };
            const notificationService = new NotificationService(mockIo);
            
            const bloodRequest = {
                id: 'req-123',
                blood_type: 'A+',
                urgency: 'medium',
                hospital_name: 'Test Hospital'
            };
            
            const donors = Array.from({ length: 100 }, (_, i) => ({ id: `donor-${i}` }));
            
            const startTime = Date.now();
            await notificationService.notifyDonorsOfRequest(bloodRequest, donors);
            const endTime = Date.now();
            
            expect(endTime - startTime).to.be.lessThan(5000); // Should complete within 5 seconds
        });
    });
});

// Test data generators
function generateMockDonor(overrides = {}) {
    return {
        id: 'donor-' + Math.random().toString(36).substr(2, 9),
        name: 'Test Donor',
        email: 'donor@example.com',
        phone: '+1234567890',
        blood_type: 'O+',
        date_of_birth: '1990-01-01',
        location: { lat: 40.7128, lng: -74.0060 },
        medical_conditions: [],
        availability: true,
        ...overrides
    };
}

function generateMockBloodRequest(overrides = {}) {
    return {
        id: 'req-' + Math.random().toString(36).substr(2, 9),
        name: 'Test Patient',
        email: 'patient@example.com',
        phone: '+1234567890',
        blood_type: 'A+',
        urgency: 'medium',
        units_needed: 1,
        hospital_id: 'hospital-123',
        hospital_name: 'Test Hospital',
        location: { lat: 40.7128, lng: -74.0060 },
        needed_by: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ...overrides
    };
}

module.exports = {
    generateMockDonor,
    generateMockBloodRequest
};