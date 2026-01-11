-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================
-- Complaints Table
-- ============================
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_name VARCHAR(100) NOT NULL,
    citizen_contact VARCHAR(20),
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    assigned_department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- Complaint Routing Table
-- ============================
CREATE TABLE IF NOT EXISTS complaint_routing (
    id SERIAL PRIMARY KEY,
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    officer_name VARCHAR(100),
    routing_reason TEXT,
    routed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- Complaint Status History
-- ============================
CREATE TABLE IF NOT EXISTS complaint_status_history (
    id SERIAL PRIMARY KEY,
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changed_by VARCHAR(100),
    change_reason TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- Complaint Analytics
-- ============================
CREATE TABLE IF NOT EXISTS complaint_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR(50),
    total_complaints INTEGER DEFAULT 0,
    resolved_complaints INTEGER DEFAULT 0,
    avg_resolution_time_hours DECIMAL(6, 2),
    high_priority_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, category)
);

-- ============================
-- Notifications Table
-- ============================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    recipient VARCHAR(100),
    notification_type VARCHAR(50),
    message TEXT,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP
);

-- ============================
-- System Events Log
-- ============================
CREATE TABLE IF NOT EXISTS system_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_source VARCHAR(50) NOT NULL,
    event_data JSONB,
    severity VARCHAR(10) DEFAULT 'info',
    message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- Indexes for Performance
-- ============================
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);

CREATE INDEX IF NOT EXISTS idx_routing_complaint_id ON complaint_routing(complaint_id);
CREATE INDEX IF NOT EXISTS idx_status_history_complaint_id ON complaint_status_history(complaint_id);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_system_events_type_time ON system_events(event_type, timestamp);

-- ============================
-- Trigger to update updated_at
-- ============================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_complaints_updated_at
BEFORE UPDATE ON complaints
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================
-- Seed Data (Sample Complaints)
-- =========================
INSERT INTO complaints
(citizen_name, citizen_contact, category, description, address, priority)
VALUES
('Ravi Kumar', '9876543210', 'Road', 'Large pothole near main road', 'MG Road, Sector 5', 'high'),
('Anita Sharma', '9123456780', 'Water', 'No water supply since 2 days', 'Rajpur Road', 'medium'),
('Amit Verma', '9988776655', 'Electricity', 'Frequent power cuts', 'Ballupur Chowk', 'medium');

-- ============================
-- Initial System Event
-- ============================
INSERT INTO system_events (event_type, event_source, message)
VALUES
('database_initialization', 'init_script', 'Complaint management database initialized successfully');

-- ============================
-- Views
-- ============================

-- Active Complaints View
CREATE OR REPLACE VIEW active_complaints AS
SELECT
    id,
    citizen_name,
    category,
    priority,
    status,
    created_at
FROM complaints
WHERE status IN ('open', 'in_progress')
ORDER BY priority DESC, created_at DESC;

-- Complaint Performance View
CREATE OR REPLACE VIEW complaint_performance AS
SELECT
    category,
    COUNT(*) AS total_complaints,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) AS resolved_complaints
FROM complaints
GROUP BY category;

-- ============================
-- Permissions (optional)
-- ============================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
