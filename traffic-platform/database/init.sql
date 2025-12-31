-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Traffic signals table
CREATE TABLE IF NOT EXISTS traffic_signals (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location_description TEXT,
    signal_type VARCHAR(20) DEFAULT 'standard',
    status VARCHAR(20) DEFAULT 'active',
    installation_date DATE,
    last_maintenance DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency detections table
CREATE TABLE IF NOT EXISTS emergency_detections (
    id SERIAL PRIMARY KEY,
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    vehicle_type VARCHAR(20) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    detection_time TIMESTAMP NOT NULL,
    image_path VARCHAR(255),
    bbox_coordinates JSONB,
    features_detected JSONB,
    action_taken VARCHAR(50),
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Signal state history table
CREATE TABLE IF NOT EXISTS signal_state_history (
    id SERIAL PRIMARY KEY,
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    state VARCHAR(10) NOT NULL,
    state_duration INTEGER NOT NULL,
    is_emergency_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    traffic_density DECIMAL(3, 2),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency routes table
CREATE TABLE IF NOT EXISTS emergency_routes (
    id SERIAL PRIMARY KEY,
    route_id VARCHAR(50) UNIQUE NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL,
    start_location JSONB NOT NULL,
    end_location JSONB NOT NULL,
    route_waypoints JSONB,
    signals_coordinated JSONB,
    total_distance DECIMAL(8, 2),
    estimated_duration INTEGER,
    actual_duration INTEGER,
    time_saved INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Traffic analytics table
CREATE TABLE IF NOT EXISTS traffic_analytics (
    id SERIAL PRIMARY KEY,
    signal_id VARCHAR(50) REFERENCES traffic_signals(id),
    date DATE NOT NULL,
    hour INTEGER NOT NULL,
    vehicle_count INTEGER DEFAULT 0,
    average_wait_time DECIMAL(5, 2) DEFAULT 0,
    emergency_overrides INTEGER DEFAULT 0,
    traffic_density DECIMAL(3, 2) DEFAULT 0,
    efficiency_score DECIMAL(3, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(signal_id, date, hour)
);

-- Hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    hospital_type VARCHAR(20) NOT NULL,
    capacity INTEGER,
    contact_number VARCHAR(20),
    emergency_services BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System events log table
CREATE TABLE IF NOT EXISTS system_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_source VARCHAR(50) NOT NULL,
    event_data JSONB,
    severity VARCHAR(10) DEFAULT 'info',
    message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emergency_detections_signal_time ON emergency_detections(signal_id, detection_time);
CREATE INDEX IF NOT EXISTS idx_signal_history_signal_time ON signal_state_history(signal_id, start_time);
CREATE INDEX IF NOT EXISTS idx_traffic_analytics_signal_date ON traffic_analytics(signal_id, date);
CREATE INDEX IF NOT EXISTS idx_system_events_type_time ON system_events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_emergency_routes_status ON emergency_routes(status, created_at);
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(latitude, longitude);

-- Insert initial traffic signals data for Dehradun
INSERT INTO traffic_signals (id, name, latitude, longitude, location_description, installation_date) VALUES
('clock_tower', 'Clock Tower', 30.3165, 78.0322, 'Main city center intersection', CURRENT_DATE),
('paltan_bazaar', 'Paltan Bazaar', 30.3203, 78.0389, 'Commercial area intersection', CURRENT_DATE),
('rispana_bridge', 'Rispana Bridge', 30.3456, 78.0512, 'Bridge crossing intersection', CURRENT_DATE),
('gandhi_road', 'Gandhi Road', 30.3293, 78.0428, 'Gandhi Road main intersection', CURRENT_DATE),
('rajpur_road', 'Rajpur Road', 30.3742, 78.0664, 'Rajpur Road intersection', CURRENT_DATE),
('saharanpur_road', 'Saharanpur Road', 30.3678, 78.0598, 'Saharanpur Road intersection', CURRENT_DATE),
('haridwar_road', 'Haridwar Road', 30.2987, 78.0234, 'Haridwar Road intersection', CURRENT_DATE),
('mussoorie_road', 'Mussoorie Road', 30.3567, 78.0789, 'Mussoorie Road intersection', CURRENT_DATE),
('chakrata_road', 'Chakrata Road', 30.3234, 78.0456, 'Chakrata Road intersection', CURRENT_DATE),
('ballupur', 'Ballupur Chowk', 30.3445, 78.0623, 'Ballupur main chowk', CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- Insert initial hospitals data for Dehradun
INSERT INTO hospitals (id, name, latitude, longitude, hospital_type, capacity, contact_number) VALUES
('doon_hospital', 'Doon Hospital', 30.3165, 78.0322, 'general', 200, '+91-135-2715001'),
('max_hospital', 'Max Super Speciality Hospital', 30.3293, 78.0428, 'specialty', 300, '+91-135-6712000'),
('himalayan_hospital', 'Himalayan Hospital', 30.3742, 78.0664, 'general', 150, '+91-135-2770000'),
('synergy_hospital', 'Synergy Hospital', 30.3456, 78.0512, 'emergency', 100, '+91-135-2749999'),
('govt_hospital', 'Government Doon Medical College Hospital', 30.3203, 78.0389, 'general', 400, '+91-135-2528888'),
('shri_mahant_hospital', 'Shri Mahant Indiresh Hospital', 30.3678, 78.0598, 'general', 250, '+91-135-2770000')
ON CONFLICT (id) DO NOTHING;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER update_traffic_signals_updated_at BEFORE UPDATE ON traffic_signals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial system event
INSERT INTO system_events (event_type, event_source, message, severity) VALUES
('database_initialization', 'init_script', 'Traffic management database initialized successfully', 'info');

-- Create a view for active emergency situations
CREATE OR REPLACE VIEW active_emergencies AS
SELECT 
    ed.id,
    ed.signal_id,
    ts.name as signal_name,
    ed.vehicle_type,
    ed.confidence,
    ed.detection_time,
    ed.action_taken,
    ed.response_time_ms,
    ts.latitude,
    ts.longitude
FROM emergency_detections ed
JOIN traffic_signals ts ON ed.signal_id = ts.id
WHERE ed.detection_time > (CURRENT_TIMESTAMP - INTERVAL '1 hour')
ORDER BY ed.detection_time DESC;

-- Create a view for signal performance metrics
CREATE OR REPLACE VIEW signal_performance AS
SELECT 
    ts.id,
    ts.name,
    COUNT(ed.id) as total_detections,
    AVG(ed.confidence) as avg_confidence,
    AVG(ed.response_time_ms) as avg_response_time,
    COUNT(CASE WHEN ed.vehicle_type = 'ambulance' THEN 1 END) as ambulance_detections,
    COUNT(CASE WHEN ed.vehicle_type = 'police' THEN 1 END) as police_detections,
    COUNT(CASE WHEN ed.vehicle_type = 'fire_truck' THEN 1 END) as fire_truck_detections,
    MAX(ed.detection_time) as last_detection
FROM traffic_signals ts
LEFT JOIN emergency_detections ed ON ts.id = ed.signal_id
WHERE ts.status = 'active'
GROUP BY ts.id, ts.name
ORDER BY total_detections DESC;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
