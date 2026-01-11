-- Migration: 005_traffic_platform_schema.sql
-- Branch: traffic-management
-- Description: Initialize traffic management platform schema with signals, detections, and analytics

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Traffic signal and vehicle type enums
CREATE TYPE signal_type_enum AS ENUM ('standard', 'smart', 'pedestrian', 'emergency_override');
CREATE TYPE signal_status_enum AS ENUM ('active', 'inactive', 'maintenance', 'error');
CREATE TYPE signal_state_enum AS ENUM ('red', 'yellow', 'green', 'flashing_red', 'flashing_yellow', 'off');
CREATE TYPE vehicle_type_enum AS ENUM ('ambulance', 'fire_truck', 'police', 'emergency_other');
CREATE TYPE route_status_enum AS ENUM ('active', 'completed', 'cancelled', 'expired');
CREATE TYPE detection_action_enum AS ENUM ('signal_override', 'route_coordination', 'notification_sent', 'no_action');

-- Traffic signals table
CREATE TABLE IF NOT EXISTS traffic_signals (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location_description TEXT,
    address TEXT,
    signal_type signal_type_enum DEFAULT 'standard',
    status signal_status_enum DEFAULT 'active',
    
    -- Technical specifications
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    firmware_version VARCHAR(50),
    installation_date DATE,
    last_maintenance DATE,
    next_maintenance_due DATE,
    
    -- Configuration
    default_timing JSONB DEFAULT '{"red": 30, "yellow": 5, "green": 25}',
    emergency_override_enabled BOOLEAN DEFAULT TRUE,
    ai_detection_enabled BOOLEAN DEFAULT TRUE,
    
    -- Connectivity
    ip_address INET,
    communication_protocol VARCHAR(20) DEFAULT 'tcp',
    last_heartbeat TIMESTAMP,
    connection_status VARCHAR(20) DEFAULT 'connected',
    
    -- Performance metrics
    uptime_percentage DECIMAL(5,2) DEFAULT 100.0,
    average_response_time_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency vehicle detections table
CREATE TABLE IF NOT EXISTS emergency_detections (
    id SERIAL PRIMARY KEY,
    detection_id VARCHAR(50) UNIQUE NOT NULL, -- Human-readable ID like ED-2024-001
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    
    -- Detection details
    vehicle_type vehicle_type_enum NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    detection_time TIMESTAMP NOT NULL,
    
    -- Image and analysis data
    image_path VARCHAR(255),
    image_hash VARCHAR(64),
    bbox_coordinates JSONB, -- Bounding box coordinates
    features_detected JSONB, -- Detected features (lights, sirens, etc.)
    
    -- Response and action
    action_taken detection_action_enum,
    response_time_ms INTEGER,
    signal_override_duration INTEGER, -- Duration in seconds
    
    -- Verification and accuracy
    is_verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(20), -- manual, automatic, crowd_sourced
    is_false_positive BOOLEAN DEFAULT FALSE,
    verification_notes TEXT,
    
    -- Analytics
    traffic_density DECIMAL(3,2), -- 0-1 scale
    weather_conditions VARCHAR(50),
    time_of_day VARCHAR(10), -- morning, afternoon, evening, night
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Signal state history table
CREATE TABLE IF NOT EXISTS signal_state_history (
    id SERIAL PRIMARY KEY,
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    
    -- State information
    state signal_state_enum NOT NULL,
    state_duration INTEGER NOT NULL, -- Duration in seconds
    
    -- Override information
    is_emergency_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    override_triggered_by UUID, -- Detection ID or manual override
    
    -- Traffic conditions
    traffic_density DECIMAL(3, 2),
    pedestrian_count INTEGER DEFAULT 0,
    vehicle_count INTEGER DEFAULT 0,
    
    -- Timing
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    planned_duration INTEGER, -- Original planned duration
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency routes table
CREATE TABLE IF NOT EXISTS emergency_routes (
    id SERIAL PRIMARY KEY,
    route_id VARCHAR(50) UNIQUE NOT NULL, -- Human-readable ID like ER-2024-001
    
    -- Route details
    vehicle_type vehicle_type_enum NOT NULL,
    start_location JSONB NOT NULL,
    end_location JSONB NOT NULL,
    route_waypoints JSONB, -- Array of coordinates
    
    -- Signal coordination
    signals_coordinated JSONB, -- Array of signal IDs
    coordination_sequence JSONB, -- Timing sequence for signals
    
    -- Route metrics
    total_distance DECIMAL(8, 2), -- Distance in kilometers
    estimated_duration INTEGER, -- Estimated time in seconds
    actual_duration INTEGER, -- Actual time taken
    time_saved INTEGER, -- Time saved due to coordination
    
    -- Status and lifecycle
    status route_status_enum DEFAULT 'active',
    priority_level INTEGER DEFAULT 1 CHECK (priority_level >= 1 AND priority_level <= 5),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Traffic analytics table (aggregated data)
CREATE TABLE IF NOT EXISTS traffic_analytics (
    id SERIAL PRIMARY KEY,
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    
    -- Time period
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    
    -- Traffic metrics
    vehicle_count INTEGER DEFAULT 0,
    pedestrian_count INTEGER DEFAULT 0,
    average_wait_time DECIMAL(5, 2) DEFAULT 0,
    peak_wait_time DECIMAL(5, 2) DEFAULT 0,
    
    -- Emergency metrics
    emergency_overrides INTEGER DEFAULT 0,
    emergency_response_time_avg INTEGER DEFAULT 0,
    
    -- Performance metrics
    traffic_density DECIMAL(3, 2) DEFAULT 0,
    efficiency_score DECIMAL(3, 2) DEFAULT 0,
    signal_uptime_percentage DECIMAL(5, 2) DEFAULT 100,
    
    -- Environmental data
    weather_conditions VARCHAR(50),
    temperature DECIMAL(4, 1),
    visibility_km DECIMAL(4, 1),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(signal_id, date, hour)
);

-- Hospitals table (for emergency routing)
CREATE TABLE IF NOT EXISTS hospitals (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT NOT NULL,
    
    -- Hospital details
    hospital_type VARCHAR(20) NOT NULL CHECK (hospital_type IN ('general', 'specialty', 'emergency', 'trauma_center')),
    capacity INTEGER,
    emergency_services BOOLEAN DEFAULT TRUE,
    trauma_center_level INTEGER CHECK (trauma_center_level >= 1 AND trauma_center_level <= 4),
    
    -- Contact information
    contact_number VARCHAR(20),
    emergency_contact VARCHAR(20),
    email VARCHAR(255),
    
    -- Operational status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'emergency_only')),
    current_capacity_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Services and facilities
    services JSONB DEFAULT '[]', -- Available medical services
    facilities JSONB DEFAULT '[]', -- Available facilities
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System events log table
CREATE TABLE IF NOT EXISTS system_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    event_source VARCHAR(50) NOT NULL,
    severity VARCHAR(10) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    
    -- Event data
    event_data JSONB,
    message TEXT,
    error_code VARCHAR(20),
    
    -- Context
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    user_id UUID, -- Reference to auth service user
    session_id VARCHAR(100),
    ip_address INET,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Traffic predictions table (ML model outputs)
CREATE TABLE IF NOT EXISTS traffic_predictions (
    id SERIAL PRIMARY KEY,
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    
    -- Prediction details
    prediction_type VARCHAR(30) NOT NULL CHECK (prediction_type IN ('traffic_volume', 'wait_time', 'congestion_level')),
    prediction_horizon INTEGER NOT NULL, -- Minutes into the future
    
    -- Predicted values
    predicted_value DECIMAL(10, 2) NOT NULL,
    confidence_interval JSONB, -- Lower and upper bounds
    model_confidence DECIMAL(5, 4) NOT NULL,
    
    -- Model information
    model_version VARCHAR(20),
    model_features JSONB, -- Features used for prediction
    
    -- Validation
    actual_value DECIMAL(10, 2), -- Actual observed value (for accuracy tracking)
    prediction_error DECIMAL(10, 2), -- Difference between predicted and actual
    
    -- Timestamps
    prediction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    target_time TIMESTAMP NOT NULL, -- Time being predicted for
    validation_time TIMESTAMP -- When actual value was recorded
);

-- Signal maintenance records table
CREATE TABLE IF NOT EXISTS signal_maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    
    -- Maintenance details
    maintenance_type VARCHAR(30) NOT NULL CHECK (maintenance_type IN ('routine', 'repair', 'upgrade', 'emergency')),
    description TEXT NOT NULL,
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Scheduling
    scheduled_date DATE,
    estimated_duration INTEGER, -- Minutes
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    
    -- Personnel
    technician_id UUID, -- Reference to auth service user
    technician_name VARCHAR(100),
    supervisor_id UUID,
    
    -- Status and results
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'failed')),
    completion_notes TEXT,
    parts_replaced JSONB DEFAULT '[]',
    cost DECIMAL(10, 2),
    
    -- Follow-up
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    warranty_expiry DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comprehensive indexes for performance
CREATE INDEX IF NOT EXISTS idx_traffic_signals_location ON traffic_signals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_traffic_signals_status ON traffic_signals(status);
CREATE INDEX IF NOT EXISTS idx_traffic_signals_type ON traffic_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_traffic_signals_maintenance ON traffic_signals(next_maintenance_due);

CREATE INDEX IF NOT EXISTS idx_emergency_detections_signal_time ON emergency_detections(signal_id, detection_time);
CREATE INDEX IF NOT EXISTS idx_emergency_detections_vehicle_type ON emergency_detections(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_emergency_detections_confidence ON emergency_detections(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_detections_verified ON emergency_detections(is_verified);
CREATE INDEX IF NOT EXISTS idx_emergency_detections_false_positive ON emergency_detections(is_false_positive);

CREATE INDEX IF NOT EXISTS idx_signal_history_signal_time ON signal_state_history(signal_id, start_time);
CREATE INDEX IF NOT EXISTS idx_signal_history_state ON signal_state_history(state);
CREATE INDEX IF NOT EXISTS idx_signal_history_emergency ON signal_state_history(is_emergency_override);

CREATE INDEX IF NOT EXISTS idx_emergency_routes_status ON emergency_routes(status);
CREATE INDEX IF NOT EXISTS idx_emergency_routes_vehicle_type ON emergency_routes(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_emergency_routes_created_at ON emergency_routes(created_at);
CREATE INDEX IF NOT EXISTS idx_emergency_routes_priority ON emergency_routes(priority_level DESC);

CREATE INDEX IF NOT EXISTS idx_traffic_analytics_signal_date ON traffic_analytics(signal_id, date);
CREATE INDEX IF NOT EXISTS idx_traffic_analytics_hour ON traffic_analytics(hour);
CREATE INDEX IF NOT EXISTS idx_traffic_analytics_efficiency ON traffic_analytics(efficiency_score DESC);

CREATE INDEX IF NOT EXISTS idx_hospitals_type ON hospitals(hospital_type);
CREATE INDEX IF NOT EXISTS idx_hospitals_status ON hospitals(status);
CREATE INDEX IF NOT EXISTS idx_hospitals_emergency ON hospitals(emergency_services);
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_system_events_type_time ON system_events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_events_signal ON system_events(signal_id);
CREATE INDEX IF NOT EXISTS idx_system_events_resolved ON system_events(is_resolved);

CREATE INDEX IF NOT EXISTS idx_traffic_predictions_signal_target ON traffic_predictions(signal_id, target_time);
CREATE INDEX IF NOT EXISTS idx_traffic_predictions_type ON traffic_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_traffic_predictions_confidence ON traffic_predictions(model_confidence DESC);

CREATE INDEX IF NOT EXISTS idx_signal_maintenance_signal ON signal_maintenance(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_maintenance_status ON signal_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_signal_maintenance_scheduled ON signal_maintenance(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_signal_maintenance_priority ON signal_maintenance(priority);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_traffic_signals_updated_at ON traffic_signals;
CREATE TRIGGER update_traffic_signals_updated_at
    BEFORE UPDATE ON traffic_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hospitals_updated_at ON hospitals;
CREATE TRIGGER update_hospitals_updated_at
    BEFORE UPDATE ON hospitals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_signal_maintenance_updated_at ON signal_maintenance;
CREATE TRIGGER update_signal_maintenance_updated_at
    BEFORE UPDATE ON signal_maintenance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample traffic signals (Dehradun locations)
INSERT INTO traffic_signals (id, name, latitude, longitude, location_description, signal_type) VALUES
    ('clock_tower', 'Clock Tower', 30.3165, 78.0322, 'Main city center intersection', 'smart'),
    ('paltan_bazaar', 'Paltan Bazaar', 30.3203, 78.0389, 'Commercial area intersection', 'smart'),
    ('rispana_bridge', 'Rispana Bridge', 30.3456, 78.0512, 'Bridge crossing intersection', 'standard'),
    ('gandhi_road', 'Gandhi Road', 30.3293, 78.0428, 'Gandhi Road main intersection', 'smart'),
    ('rajpur_road', 'Rajpur Road', 30.3742, 78.0664, 'Rajpur Road intersection', 'standard'),
    ('saharanpur_road', 'Saharanpur Road', 30.3678, 78.0598, 'Saharanpur Road intersection', 'standard'),
    ('haridwar_road', 'Haridwar Road', 30.2987, 78.0234, 'Haridwar Road intersection', 'standard'),
    ('mussoorie_road', 'Mussoorie Road', 30.3567, 78.0789, 'Mussoorie Road intersection', 'smart'),
    ('chakrata_road', 'Chakrata Road', 30.3234, 78.0456, 'Chakrata Road intersection', 'standard'),
    ('ballupur', 'Ballupur Chowk', 30.3445, 78.0623, 'Ballupur main chowk', 'smart')
ON CONFLICT (id) DO NOTHING;

-- Insert sample hospitals
INSERT INTO hospitals (id, name, latitude, longitude, address, hospital_type, emergency_services, contact_number) VALUES
    ('doon_hospital', 'Doon Hospital', 30.3165, 78.0322, 'Patel Nagar, Dehradun', 'general', TRUE, '+91-135-2715001'),
    ('max_hospital', 'Max Super Speciality Hospital', 30.3293, 78.0428, 'Mussoorie Road, Dehradun', 'specialty', TRUE, '+91-135-6712000'),
    ('himalayan_hospital', 'Himalayan Hospital', 30.3742, 78.0664, 'Jolly Grant, Dehradun', 'general', TRUE, '+91-135-2770000'),
    ('synergy_hospital', 'Synergy Hospital', 30.3456, 78.0512, 'Rispana, Dehradun', 'emergency', TRUE, '+91-135-2749999'),
    ('govt_hospital', 'Government Doon Medical College Hospital', 30.3203, 78.0389, 'Patel Nagar, Dehradun', 'general', TRUE, '+91-135-2528888'),
    ('shri_mahant_hospital', 'Shri Mahant Indiresh Hospital', 30.3678, 78.0598, 'Patel Nagar, Dehradun', 'general', TRUE, '+91-135-2770000')
ON CONFLICT (id) DO NOTHING;