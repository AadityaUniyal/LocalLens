import os
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

# Import our custom modules
from detection.vehicle_detector import EmergencyVehicleDetector
from routing.route_optimizer import RouteOptimizer
from signals.signal_controller import SignalController
from config.database import DatabaseManager
from utils.logger import setup_logger

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Setup logging
logger = setup_logger(__name__)

# Initialize components
detector = EmergencyVehicleDetector()
route_optimizer = RouteOptimizer()
signal_controller = SignalController()
db_manager = DatabaseManager()

# Redis connection for caching
redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))

@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('dashboard.html')

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'traffic-management',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })

@app.route('/api/detect/vehicle', methods=['POST'])
def detect_emergency_vehicle():
    """
    Detect emergency vehicles in uploaded image/video frame
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        signal_id = request.form.get('signal_id')
        
        if not signal_id:
            return jsonify({'error': 'Signal ID is required'}), 400
        
        # Detect emergency vehicle
        detection_result = detector.detect_emergency_vehicle(image_file)
        
        if detection_result['is_emergency']:
            # Log detection
            db_manager.log_emergency_detection(
                signal_id=signal_id,
                vehicle_type=detection_result['vehicle_type'],
                confidence=detection_result['confidence'],
                detection_time=datetime.utcnow()
            )
            
            # Trigger signal override
            override_result = signal_controller.emergency_override(signal_id)
            
            # Calculate route if it's an ambulance
            route_result = None
            if detection_result['vehicle_type'] == 'ambulance':
                route_result = route_optimizer.calculate_emergency_route(signal_id)
            
            return jsonify({
                'detection': detection_result,
                'signal_override': override_result,
                'route': route_result,
                'timestamp': datetime.utcnow().isoformat()
            })
        else:
            return jsonify({
                'detection': detection_result,
                'message': 'No emergency vehicle detected',
                'timestamp': datetime.utcnow().isoformat()
            })
            
    except Exception as e:
        logger.error(f"Error in vehicle detection: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/detect/status', methods=['GET'])
def get_detection_status():
    """Get detection system status"""
    try:
        status = detector.get_system_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting detection status: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/signals', methods=['GET'])
def get_all_signals():
    """Get all traffic signals"""
    try:
        signals = db_manager.get_all_signals()
        return jsonify({'signals': signals})
    except Exception as e:
        logger.error(f"Error getting signals: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/signals/<signal_id>', methods=['GET'])
def get_signal(signal_id):
    """Get specific traffic signal details"""
    try:
        signal = db_manager.get_signal_by_id(signal_id)
        if not signal:
            return jsonify({'error': 'Signal not found'}), 404
        return jsonify({'signal': signal})
    except Exception as e:
        logger.error(f"Error getting signal {signal_id}: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/signals/<signal_id>/override', methods=['POST'])
def override_signal(signal_id):
    """Manually override traffic signal for emergency"""
    try:
        data = request.get_json()
        duration = data.get('duration', 60)  # Default 60 seconds
        reason = data.get('reason', 'Manual override')
        
        result = signal_controller.emergency_override(signal_id, duration, reason)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error overriding signal {signal_id}: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/signals/<signal_id>/timing', methods=['PUT'])
def update_signal_timing(signal_id):
    """Update signal timing configuration"""
    try:
        data = request.get_json()
        timing_config = {
            'red_duration': data.get('red_duration', 45),
            'yellow_duration': data.get('yellow_duration', 5),
            'green_duration': data.get('green_duration', 30)
        }
        
        result = signal_controller.update_timing(signal_id, timing_config)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error updating signal timing {signal_id}: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/routing/emergency', methods=['POST'])
def calculate_emergency_route():
    """Calculate emergency route to nearest hospital"""
    try:
        data = request.get_json()
        current_location = data.get('current_location')
        vehicle_type = data.get('vehicle_type', 'ambulance')
        
        if not current_location:
            return jsonify({'error': 'Current location is required'}), 400
        
        route = route_optimizer.calculate_emergency_route(
            current_location=current_location,
            vehicle_type=vehicle_type
        )
        
        return jsonify({'route': route})
    except Exception as e:
        logger.error(f"Error calculating emergency route: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/routing/hospitals', methods=['GET'])
def get_nearby_hospitals():
    """Get nearby hospitals"""
    try:
        lat = request.args.get('lat', type=float)
        lng = request.args.get('lng', type=float)
        radius = request.args.get('radius', default=10, type=int)
        
        if not lat or not lng:
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        
        hospitals = route_optimizer.get_nearby_hospitals(lat, lng, radius)
        return jsonify({'hospitals': hospitals})
    except Exception as e:
        logger.error(f"Error getting nearby hospitals: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/analytics/traffic', methods=['GET'])
def get_traffic_analytics():
    """Get traffic flow analytics"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        analytics = db_manager.get_traffic_analytics(start_date, end_date)
        return jsonify({'analytics': analytics})
    except Exception as e:
        logger.error(f"Error getting traffic analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/analytics/emergency', methods=['GET'])
def get_emergency_analytics():
    """Get emergency response metrics"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        analytics = db_manager.get_emergency_analytics(start_date, end_date)
        return jsonify({'analytics': analytics})
    except Exception as e:
        logger.error(f"Error getting emergency analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/signals/coordinate', methods=['POST'])
def coordinate_signals():
    """Coordinate multiple signals for green corridor"""
    try:
        data = request.get_json()
        route_signals = data.get('route_signals', [])
        duration = data.get('duration', 120)
        
        if not route_signals:
            return jsonify({'error': 'Route signals are required'}), 400
        
        result = signal_controller.coordinate_green_corridor(route_signals, duration)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error coordinating signals: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/dashboard/metrics', methods=['GET'])
def get_dashboard_metrics():
    """Get dashboard metrics"""
    try:
        # Get signal status
        signals_status = signal_controller.get_all_signals_status()
        
        # Get emergency analytics
        emergency_analytics = db_manager.get_emergency_analytics()
        
        # Calculate metrics
        total_signals = signals_status.get('total_signals', 0)
        emergency_overrides = signals_status.get('emergency_overrides_active', 0)
        
        # Get today's detections (simulated)
        detections_today = 3  # This would come from database in production
        
        # Average response time (simulated)
        avg_response_time = 850  # milliseconds
        
        return jsonify({
            'active_signals': total_signals,
            'emergency_overrides': emergency_overrides,
            'detections_today': detections_today,
            'avg_response_time': avg_response_time,
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting dashboard metrics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/dashboard/emergency-log', methods=['GET'])
def get_emergency_log():
    """Get recent emergency detections log"""
    try:
        # In production, this would query the database
        # For now, return simulated data
        emergency_log = [
            {
                'id': 1,
                'timestamp': '2024-01-15T14:32:15Z',
                'signal_id': 'clock_tower',
                'signal_name': 'Clock Tower',
                'vehicle_type': 'ambulance',
                'confidence': 0.94,
                'action_taken': 'signal_override',
                'response_time_ms': 750
            },
            {
                'id': 2,
                'timestamp': '2024-01-15T13:45:22Z',
                'signal_id': 'paltan_bazaar',
                'signal_name': 'Paltan Bazaar',
                'vehicle_type': 'police',
                'confidence': 0.87,
                'action_taken': 'route_calculated',
                'response_time_ms': 920
            }
        ]
        
        return jsonify({
            'emergency_log': emergency_log,
            'total_count': len(emergency_log)
        })
    except Exception as e:
        logger.error(f"Error getting emergency log: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/dashboard/analytics', methods=['GET'])
def get_dashboard_analytics():
    """Get analytics data for dashboard charts"""
    try:
        # Generate hourly data for the last 24 hours
        import random
        from datetime import timedelta
        
        hours = []
        detections = []
        overrides = []
        
        current_time = datetime.utcnow()
        
        for i in range(24):
            hour_time = current_time - timedelta(hours=23-i)
            hours.append(hour_time.strftime('%H:00'))
            
            # Simulate realistic patterns
            hour = hour_time.hour
            if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
                detections.append(random.randint(2, 8))
                overrides.append(random.randint(1, 5))
            elif 10 <= hour <= 16:  # Daytime
                detections.append(random.randint(1, 4))
                overrides.append(random.randint(0, 3))
            else:  # Night/early morning
                detections.append(random.randint(0, 2))
                overrides.append(random.randint(0, 1))
        
        return jsonify({
            'hours': hours,
            'detections': detections,
            'overrides': overrides,
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting dashboard analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/signals/<signal_id>/status', methods=['GET'])
def get_signal_status_detailed(signal_id):
    """Get detailed status of a specific signal"""
    try:
        # Get signal status from controller
        status = signal_controller.get_signal_status(signal_id)
        
        # Get traffic density if available
        traffic_density = signal_controller.get_traffic_density_status(signal_id)
        
        # Combine data
        detailed_status = {
            **status,
            'traffic_density': traffic_density,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(detailed_status)
    except Exception as e:
        logger.error(f"Error getting detailed signal status: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/routing/traffic-conditions', methods=['GET'])
def get_traffic_conditions():
    """Get current traffic conditions for all signals"""
    try:
        conditions = route_optimizer.get_real_time_traffic_conditions()
        return jsonify(conditions)
    except Exception as e:
        logger.error(f"Error getting traffic conditions: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/routing/optimize', methods=['POST'])
def optimize_route_with_traffic():
    """Calculate optimized route with real-time traffic data"""
    try:
        data = request.get_json()
        current_location = data.get('current_location')
        vehicle_type = data.get('vehicle_type', 'ambulance')
        destination_type = data.get('destination_type', 'hospital')
        
        if not current_location:
            return jsonify({'error': 'Current location is required'}), 400
        
        route = route_optimizer.find_optimal_emergency_route_with_traffic(
            current_location=current_location,
            vehicle_type=vehicle_type,
            destination_type=destination_type
        )
        
        return jsonify(route)
    except Exception as e:
        logger.error(f"Error optimizing route with traffic: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/system/status', methods=['GET'])
def get_system_status():
    """Get overall system status"""
    try:
        # Check component health
        detector_status = detector.get_system_status()
        
        # Check database connection
        try:
            db_signals = db_manager.get_all_signals()
            db_status = {'status': 'healthy', 'signals_count': len(db_signals)}
        except Exception as e:
            db_status = {'status': 'unhealthy', 'error': str(e)}
        
        # Check Redis connection
        try:
            redis_client.ping()
            redis_status = {'status': 'healthy'}
        except Exception as e:
            redis_status = {'status': 'unhealthy', 'error': str(e)}
        
        # Overall system health
        all_healthy = (
            detector_status.get('status') == 'operational' and
            db_status.get('status') == 'healthy' and
            redis_status.get('status') == 'healthy'
        )
        
        return jsonify({
            'overall_status': 'healthy' if all_healthy else 'degraded',
            'components': {
                'detection_system': detector_status,
                'database': db_status,
                'redis_cache': redis_status,
                'signal_controller': {'status': 'healthy'},
                'route_optimizer': {'status': 'healthy'}
            },
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Initialize database tables
    db_manager.initialize_database()
    
    # Start the Flask application
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f"Starting Traffic Management Platform on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
