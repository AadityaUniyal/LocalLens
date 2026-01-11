import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json
import sys

# Add shared database config to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared', 'database'))

class DatabaseManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Use Neon database configuration for traffic branch
        self.branch_name = 'traffic'
        self.db_url = self._get_neon_connection_string()
        
        # Connection pool
        self.connection_pool = None
        self._initialize_connection_pool()
        
        print(f'🚦 Traffic Platform using Neon traffic-management branch')
    
    def _get_neon_connection_string(self):
        """Get Neon connection string for traffic branch"""
        base_url = os.getenv('NEON_DATABASE_URL')
        project_id = os.getenv('NEON_PROJECT_ID')
        
        if not base_url or not project_id:
            # Fallback to local development
            return os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5436/local_lens_traffic')
        
        # Parse base URL components
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        
        # Construct traffic branch connection string
        connection_string = f"postgresql://{parsed.username}:{parsed.password}@{parsed.hostname}:{parsed.port or 5432}/neondb?options=project%3D{project_id}-traffic-management"
        
        return connection_string
    
    def _initialize_connection_pool(self):
        """Initialize database connection pool"""
        try:
            self.connection_pool = SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=self.db_url
            )
            self.logger.info("✅ Traffic Platform database connection pool initialized with Neon traffic-management branch")
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize database connection pool: {e}")
            raise
    
    def get_connection(self):
        """Get a connection from the pool"""
        try:
            return self.connection_pool.getconn()
        except Exception as e:
            self.logger.error(f"Failed to get database connection: {e}")
            raise
    
    def return_connection(self, conn):
        """Return a connection to the pool"""
        try:
            self.connection_pool.putconn(conn)
        except Exception as e:
            self.logger.error(f"Failed to return database connection: {e}")
    
    def initialize_database(self):
        """Initialize database (schema handled by migrations)"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Test connection
            cursor.execute('SELECT 1 as health_check, NOW() as timestamp')
            result = cursor.fetchone()
            
            cursor.close()
            self.return_connection(conn)
            
            self.logger.info("✅ Traffic Platform database initialized successfully with Neon traffic-management branch")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize database: {e}")
            if conn:
                cursor.close()
                self.return_connection(conn)
            raise
    
    def log_emergency_detection(self, signal_id: str, vehicle_type: str, 
                              confidence: float, detection_time: datetime,
                              bbox_coordinates: Dict = None, features_detected: List = None,
                              action_taken: str = None, response_time_ms: int = None,
                              image_path: str = None) -> str:
        """Log emergency vehicle detection"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Generate detection ID
            cursor.execute("SELECT COUNT(*) FROM emergency_detections WHERE detection_time::date = CURRENT_DATE")
            daily_count = cursor.fetchone()[0] + 1
            detection_id = f"ED-{datetime.now().strftime('%Y')}-{daily_count:03d}"
            
            cursor.execute("""
                INSERT INTO emergency_detections 
                (detection_id, signal_id, vehicle_type, confidence, detection_time, 
                 image_path, bbox_coordinates, features_detected, action_taken, response_time_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING detection_id
            """, (
                detection_id, signal_id, vehicle_type, confidence, detection_time,
                image_path,
                json.dumps(bbox_coordinates) if bbox_coordinates else None,
                json.dumps(features_detected) if features_detected else None,
                action_taken, response_time_ms
            ))
            
            result_detection_id = cursor.fetchone()[0]
            conn.commit()
            cursor.close()
            self.return_connection(conn)
            
            return result_detection_id
            
        except Exception as e:
            self.logger.error(f"Failed to log emergency detection: {e}")
            if conn:
                conn.rollback()
                cursor.close()
                self.return_connection(conn)
            raise
    
    def log_signal_state_change(self, signal_id: str, state: str, duration: int,
                              is_emergency_override: bool = False, override_reason: str = None,
                              traffic_density: float = None) -> int:
        """Log signal state change"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            start_time = datetime.utcnow()
            end_time = start_time + timedelta(seconds=duration)
            
            cursor.execute("""
                INSERT INTO signal_state_history 
                (signal_id, state, state_duration, is_emergency_override, override_reason, 
                 traffic_density, start_time, end_time)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                signal_id, state, duration, is_emergency_override, override_reason,
                traffic_density, start_time, end_time
            ))
            
            history_id = cursor.fetchone()[0]
            conn.commit()
            cursor.close()
            self.return_connection(conn)
            
            return history_id
            
        except Exception as e:
            self.logger.error(f"Failed to log signal state change: {e}")
            if conn:
                conn.rollback()
                cursor.close()
                self.return_connection(conn)
            raise
    
    def create_emergency_route(self, vehicle_type: str,
                             start_location: Dict, end_location: Dict,
                             route_waypoints: List = None, signals_coordinated: List = None,
                             total_distance: float = None, estimated_duration: int = None,
                             priority_level: int = 1) -> str:
        """Create emergency route record"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Generate route ID
            cursor.execute("SELECT COUNT(*) FROM emergency_routes WHERE created_at::date = CURRENT_DATE")
            daily_count = cursor.fetchone()[0] + 1
            route_id = f"ER-{datetime.now().strftime('%Y')}-{daily_count:03d}"
            
            cursor.execute("""
                INSERT INTO emergency_routes 
                (route_id, vehicle_type, start_location, end_location, route_waypoints,
                 signals_coordinated, total_distance, estimated_duration, priority_level)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING route_id
            """, (
                route_id, vehicle_type, json.dumps(start_location), json.dumps(end_location),
                json.dumps(route_waypoints) if route_waypoints else None,
                json.dumps(signals_coordinated) if signals_coordinated else None,
                total_distance, estimated_duration, priority_level
            ))
            
            result_route_id = cursor.fetchone()[0]
            conn.commit()
            cursor.close()
            self.return_connection(conn)
            
            return result_route_id
            
        except Exception as e:
            self.logger.error(f"Failed to create emergency route: {e}")
            if conn:
                conn.rollback()
                cursor.close()
                self.return_connection(conn)
            raise
    
    def update_route_completion(self, route_id: str, actual_duration: int, 
                              time_saved: int, status: str = 'completed'):
        """Update emergency route with completion data"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE emergency_routes 
                SET actual_duration = %s, time_saved = %s, status = %s, completed_at = %s
                WHERE route_id = %s
            """, (actual_duration, time_saved, status, datetime.utcnow(), route_id))
            
            conn.commit()
            cursor.close()
            self.return_connection(conn)
            
        except Exception as e:
            self.logger.error(f"Failed to update route completion: {e}")
            if conn:
                conn.rollback()
                cursor.close()
                self.return_connection(conn)
            raise
    
    def get_all_signals(self) -> List[Dict]:
        """Get all traffic signals"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT id, name, latitude, longitude, location_description, 
                       signal_type, status, installation_date, last_maintenance,
                       default_timing, emergency_override_enabled, ai_detection_enabled,
                       ip_address, last_heartbeat, connection_status
                FROM traffic_signals 
                WHERE status = 'active'
                ORDER BY name
            """)
            
            signals = cursor.fetchall()
            cursor.close()
            self.return_connection(conn)
            
            return [dict(signal) for signal in signals]
            
        except Exception as e:
            self.logger.error(f"Failed to get all signals: {e}")
            if conn:
                cursor.close()
                self.return_connection(conn)
            return []
    
    def get_signal_by_id(self, signal_id: str) -> Optional[Dict]:
        """Get specific traffic signal by ID"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT id, name, latitude, longitude, location_description, 
                       signal_type, status, installation_date, last_maintenance,
                       default_timing, emergency_override_enabled, ai_detection_enabled,
                       ip_address, last_heartbeat, connection_status
                FROM traffic_signals 
                WHERE id = %s
            """, (signal_id,))
            
            signal = cursor.fetchone()
            cursor.close()
            self.return_connection(conn)
            
            return dict(signal) if signal else None
            
        except Exception as e:
            self.logger.error(f"Failed to get signal {signal_id}: {e}")
            if conn:
                cursor.close()
                self.return_connection(conn)
            return None
    
    def update_signal_heartbeat(self, signal_id: str, connection_status: str = 'connected'):
        """Update signal heartbeat and connection status"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE traffic_signals 
                SET last_heartbeat = %s, connection_status = %s, updated_at = %s
                WHERE id = %s
            """, (datetime.utcnow(), connection_status, datetime.utcnow(), signal_id))
            
            conn.commit()
            cursor.close()
            self.return_connection(conn)
            
        except Exception as e:
            self.logger.error(f"Failed to update signal heartbeat: {e}")
            if conn:
                conn.rollback()
                cursor.close()
                self.return_connection(conn)
    
    def get_traffic_analytics(self, start_date: str = None, end_date: str = None) -> Dict:
        """Get traffic analytics data"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Default to last 7 days if no dates provided
            if not start_date:
                start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            # Get overall analytics
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_detections,
                    COUNT(DISTINCT signal_id) as signals_with_detections,
                    AVG(confidence) as avg_confidence,
                    COUNT(CASE WHEN vehicle_type = 'ambulance' THEN 1 END) as ambulance_detections,
                    COUNT(CASE WHEN vehicle_type = 'police' THEN 1 END) as police_detections,
                    COUNT(CASE WHEN vehicle_type = 'fire_truck' THEN 1 END) as fire_truck_detections
                FROM emergency_detections 
                WHERE detection_time::date BETWEEN %s AND %s
            """, (start_date, end_date))
            
            overall_stats = cursor.fetchone()
            
            # Get daily breakdown
            cursor.execute("""
                SELECT 
                    detection_time::date as date,
                    COUNT(*) as detections,
                    COUNT(DISTINCT signal_id) as signals_involved,
                    AVG(confidence) as avg_confidence
                FROM emergency_detections 
                WHERE detection_time::date BETWEEN %s AND %s
                GROUP BY detection_time::date
                ORDER BY date
            """, (start_date, end_date))
            
            daily_stats = cursor.fetchall()
            
            # Get signal-wise statistics
            cursor.execute("""
                SELECT 
                    s.id, s.name,
                    COUNT(ed.id) as detections,
                    AVG(ed.confidence) as avg_confidence,
                    MAX(ed.detection_time) as last_detection
                FROM traffic_signals s
                LEFT JOIN emergency_detections ed ON s.id = ed.signal_id 
                    AND ed.detection_time::date BETWEEN %s AND %s
                GROUP BY s.id, s.name
                ORDER BY detections DESC
            """, (start_date, end_date))
            
            signal_stats = cursor.fetchall()
            
            cursor.close()
            self.return_connection(conn)
            
            return {
                'period': {'start_date': start_date, 'end_date': end_date},
                'overall': dict(overall_stats) if overall_stats else {},
                'daily_breakdown': [dict(day) for day in daily_stats],
                'signal_statistics': [dict(signal) for signal in signal_stats]
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get traffic analytics: {e}")
            if conn:
                cursor.close()
                self.return_connection(conn)
            return {}
    
    def get_emergency_analytics(self, start_date: str = None, end_date: str = None) -> Dict:
        """Get emergency response analytics"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Default to last 30 days if no dates provided
            if not start_date:
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            # Get emergency route statistics
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_routes,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_routes,
                    AVG(total_distance) as avg_distance,
                    AVG(estimated_duration) as avg_estimated_duration,
                    AVG(actual_duration) as avg_actual_duration,
                    AVG(time_saved) as avg_time_saved,
                    COUNT(CASE WHEN vehicle_type = 'ambulance' THEN 1 END) as ambulance_routes,
                    COUNT(CASE WHEN vehicle_type = 'police' THEN 1 END) as police_routes,
                    COUNT(CASE WHEN vehicle_type = 'fire_truck' THEN 1 END) as fire_truck_routes
                FROM emergency_routes 
                WHERE created_at::date BETWEEN %s AND %s
            """, (start_date, end_date))
            
            route_stats = cursor.fetchone()
            
            # Get response time statistics
            cursor.execute("""
                SELECT 
                    AVG(response_time_ms) as avg_response_time,
                    MIN(response_time_ms) as min_response_time,
                    MAX(response_time_ms) as max_response_time,
                    COUNT(CASE WHEN response_time_ms < 1000 THEN 1 END) as fast_responses,
                    COUNT(CASE WHEN response_time_ms >= 1000 AND response_time_ms < 3000 THEN 1 END) as medium_responses,
                    COUNT(CASE WHEN response_time_ms >= 3000 THEN 1 END) as slow_responses
                FROM emergency_detections 
                WHERE detection_time::date BETWEEN %s AND %s 
                AND response_time_ms IS NOT NULL
            """, (start_date, end_date))
            
            response_stats = cursor.fetchone()
            
            # Get hourly distribution
            cursor.execute("""
                SELECT 
                    EXTRACT(hour FROM detection_time) as hour,
                    COUNT(*) as detections
                FROM emergency_detections 
                WHERE detection_time::date BETWEEN %s AND %s
                GROUP BY EXTRACT(hour FROM detection_time)
                ORDER BY hour
            """, (start_date, end_date))
            
            hourly_distribution = cursor.fetchall()
            
            cursor.close()
            self.return_connection(conn)
            
            return {
                'period': {'start_date': start_date, 'end_date': end_date},
                'route_statistics': dict(route_stats) if route_stats else {},
                'response_time_statistics': dict(response_stats) if response_stats else {},
                'hourly_distribution': [dict(hour) for hour in hourly_distribution]
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get emergency analytics: {e}")
            if conn:
                cursor.close()
                self.return_connection(conn)
            return {}
    
    def log_system_event(self, event_type: str, event_source: str, 
                        event_data: Dict = None, severity: str = 'info', 
                        message: str = None, signal_id: str = None):
        """Log system events"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Generate event ID
            cursor.execute("SELECT COUNT(*) FROM system_events WHERE timestamp::date = CURRENT_DATE")
            daily_count = cursor.fetchone()[0] + 1
            event_id = f"SE-{datetime.now().strftime('%Y%m%d')}-{daily_count:04d}"
            
            cursor.execute("""
                INSERT INTO system_events (event_id, event_type, event_source, event_data, 
                                         severity, message, signal_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                event_id, event_type, event_source, 
                json.dumps(event_data) if event_data else None,
                severity, message, signal_id
            ))
            
            conn.commit()
            cursor.close()
            self.return_connection(conn)
            
        except Exception as e:
            self.logger.error(f"Failed to log system event: {e}")
            if conn:
                conn.rollback()
                cursor.close()
                self.return_connection(conn)
    
    def get_hospitals(self, hospital_type: str = None, emergency_only: bool = False) -> List[Dict]:
        """Get hospitals for emergency routing"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = "SELECT * FROM hospitals WHERE status = 'active'"
            params = []
            
            if hospital_type:
                query += " AND hospital_type = %s"
                params.append(hospital_type)
            
            if emergency_only:
                query += " AND emergency_services = true"
            
            query += " ORDER BY name"
            
            cursor.execute(query, params)
            hospitals = cursor.fetchall()
            cursor.close()
            self.return_connection(conn)
            
            return [dict(hospital) for hospital in hospitals]
            
        except Exception as e:
            self.logger.error(f"Failed to get hospitals: {e}")
            if conn:
                cursor.close()
                self.return_connection(conn)
            return []
    
    def cleanup_old_data(self, days_to_keep: int = 90):
        """Clean up old data to maintain database performance"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            
            # Clean old emergency detections
            cursor.execute("""
                DELETE FROM emergency_detections 
                WHERE detection_time < %s
            """, (cutoff_date,))
            
            # Clean old signal state history
            cursor.execute("""
                DELETE FROM signal_state_history 
                WHERE start_time < %s
            """, (cutoff_date,))
            
            # Clean old system events
            cursor.execute("""
                DELETE FROM system_events 
                WHERE timestamp < %s
            """, (cutoff_date,))
            
            # Clean old traffic analytics (keep aggregated data longer)
            analytics_cutoff = datetime.now() - timedelta(days=days_to_keep * 2)
            cursor.execute("""
                DELETE FROM traffic_analytics 
                WHERE date < %s
            """, (analytics_cutoff.date(),))
            
            conn.commit()
            cursor.close()
            self.return_connection(conn)
            
            self.logger.info(f"Cleaned up data older than {days_to_keep} days")
            
        except Exception as e:
            self.logger.error(f"Failed to cleanup old data: {e}")
            if conn:
                conn.rollback()
                cursor.close()
                self.return_connection(conn)
    
    def close_all_connections(self):
        """Close all database connections"""
        if self.connection_pool:
            self.connection_pool.closeall()
            self.logger.info("All database connections closed")