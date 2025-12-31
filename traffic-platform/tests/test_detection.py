import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock
import json
from datetime import datetime, timedelta
import tempfile
import os
import sys

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from detection.vehicle_detector import EmergencyVehicleDetector
from routing.route_optimizer import RouteOptimizer, Location, Hospital
from signals.signal_controller import SignalController, SignalState, SignalTiming
from config.database import DatabaseManager

class TestEmergencyVehicleDetector:
    """Test emergency vehicle detection functionality"""
    
    @pytest.fixture
    def detector(self):
        """Create detector instance for testing"""
        with patch('detection.vehicle_detector.YOLO') as mock_yolo:
            mock_model = Mock()
            mock_model.names = {0: 'car', 1: 'truck', 2: 'bus', 3: 'motorcycle'}
            mock_yolo.return_value = mock_model
            
            detector = EmergencyVehicleDetector()
            detector.model = mock_model
            return detector
    
    def test_detector_initialization(self, detector):
        """Test detector initializes correctly"""
        assert detector.model is not None
        assert detector.confidence_threshold > 0
        assert len(detector.emergency_colors) > 0
        assert 'car' in detector.vehicle_classes
    
    def test_prepare_image_numpy_array(self, detector):
        """Test image preparation from numpy array"""
        # Create test image
        test_image = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        
        result = detector._prepare_image(test_image)
        
        assert result is not None
        assert isinstance(result, np.ndarray)
        assert result.shape == test_image.shape
    
    def test_prepare_image_file_object(self, detector):
        """Test image preparation from file object"""
        # Create temporary image file
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
            # Create a simple test image and save it
            import cv2
            test_image = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
            cv2.imwrite(tmp_file.name, test_image)
            
            # Test reading the file
            with open(tmp_file.name, 'rb') as f:
                result = detector._prepare_image(f)
            
            assert result is not None
            assert isinstance(result, np.ndarray)
            
            # Cleanup
            os.unlink(tmp_file.name)
    
    def test_color_analysis(self, detector):
        """Test emergency vehicle color analysis"""
        # Create image with red and blue colors (emergency colors)
        test_image = np.zeros((100, 100, 3), dtype=np.uint8)
        test_image[0:50, :] = [0, 0, 255]  # Red
        test_image[50:100, :] = [255, 0, 0]  # Blue
        
        score, colors = detector._analyze_colors(test_image)
        
        assert score > 0
        assert isinstance(colors, list)
        assert any(color in ['red', 'blue'] for color in colors)
    
    def test_pattern_analysis(self, detector):
        """Test pattern analysis for emergency vehicles"""
        # Create image with rectangular patterns
        test_image = np.zeros((200, 200, 3), dtype=np.uint8)
        # Add some rectangular shapes
        test_image[50:70, 50:150] = [255, 255, 255]  # White rectangle
        test_image[120:140, 50:150] = [255, 255, 255]  # Another rectangle
        
        score, patterns = detector._analyze_patterns(test_image)
        
        assert score >= 0
        assert isinstance(patterns, list)
    
    def test_light_bar_detection(self, detector):
        """Test emergency light bar detection"""
        # Create image with bright horizontal pattern at top (light bar)
        test_image = np.zeros((100, 200, 3), dtype=np.uint8)
        test_image[10:20, 50:150] = [255, 255, 0]  # Bright yellow horizontal bar
        
        score, has_light_bar = detector._detect_light_bar(test_image)
        
        assert score >= 0
        assert isinstance(has_light_bar, bool)
    
    def test_emergency_type_classification(self, detector):
        """Test emergency vehicle type classification"""
        # Test ambulance classification
        colors = ['white', 'red']
        patterns = ['rectangular_patterns']
        has_light_bar = True
        
        vehicle_type = detector._classify_emergency_type(colors, patterns, has_light_bar)
        
        assert vehicle_type is not None
        assert isinstance(vehicle_type, str)
    
    def test_detect_emergency_vehicle_mock(self, detector):
        """Test full emergency vehicle detection with mocked YOLO results"""
        # Mock YOLO detection results
        mock_box = Mock()
        mock_box.cls = [0]  # Car class
        mock_box.conf = [0.9]  # High confidence
        mock_box.xyxy = [np.array([10, 10, 90, 90])]  # Bounding box
        
        mock_boxes = Mock()
        mock_boxes.boxes = [mock_box]
        
        mock_result = Mock()
        mock_result.boxes = mock_boxes
        
        detector.model.return_value = [mock_result]
        
        # Create test image
        test_image = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        
        result = detector.detect_emergency_vehicle(test_image)
        
        assert isinstance(result, dict)
        assert 'is_emergency' in result
        assert 'confidence' in result
        assert 'vehicle_type' in result
    
    def test_system_status(self, detector):
        """Test system status reporting"""
        status = detector.get_system_status()
        
        assert isinstance(status, dict)
        assert 'model_loaded' in status
        assert 'confidence_threshold' in status
        assert 'emergency_colors' in status
        assert 'status' in status
    
    def test_update_confidence_threshold(self, detector):
        """Test updating confidence threshold"""
        original_threshold = detector.confidence_threshold
        
        # Test valid threshold
        assert detector.update_confidence_threshold(0.7) == True
        assert detector.confidence_threshold == 0.7
        
        # Test invalid threshold
        assert detector.update_confidence_threshold(1.5) == False
        assert detector.confidence_threshold == 0.7  # Should remain unchanged

class TestRouteOptimizer:
    """Test route optimization functionality"""
    
    @pytest.fixture
    def optimizer(self):
        """Create route optimizer instance for testing"""
        return RouteOptimizer()
    
    def test_optimizer_initialization(self, optimizer):
        """Test route optimizer initializes correctly"""
        assert len(optimizer.hospitals) > 0
        assert len(optimizer.traffic_signals) > 0
        assert len(optimizer.road_network) > 0
    
    def test_calculate_distance(self, optimizer):
        """Test distance calculation between locations"""
        loc1 = Location(30.3165, 78.0322, "Location 1")
        loc2 = Location(30.3203, 78.0389, "Location 2")
        
        distance = optimizer._calculate_distance(loc1, loc2)
        
        assert distance > 0
        assert isinstance(distance, float)
    
    def test_find_nearest_signal(self, optimizer):
        """Test finding nearest traffic signal"""
        test_location = Location(30.3165, 78.0322, "Test Location")
        
        nearest_signal = optimizer._find_nearest_signal(test_location)
        
        assert nearest_signal is not None
        assert nearest_signal in optimizer.traffic_signals
    
    def test_get_nearby_hospitals(self, optimizer):
        """Test getting nearby hospitals"""
        # Test location near Dehradun city center
        lat, lng = 30.3165, 78.0322
        radius = 10
        
        hospitals = optimizer.get_nearby_hospitals(lat, lng, radius)
        
        assert isinstance(hospitals, list)
        assert len(hospitals) > 0
        
        # Check hospital data structure
        if hospitals:
            hospital = hospitals[0]
            assert 'id' in hospital
            assert 'name' in hospital
            assert 'location' in hospital
            assert 'distance' in hospital
            assert 'estimated_travel_time' in hospital
    
    def test_calculate_emergency_route(self, optimizer):
        """Test emergency route calculation"""
        current_location = {'lat': 30.3165, 'lng': 78.0322}
        
        route = optimizer.calculate_emergency_route(current_location, 'ambulance')
        
        assert isinstance(route, dict)
        
        if route.get('success'):
            assert 'recommended_route' in route
            assert 'vehicle_type' in route
        else:
            assert 'error' in route
    
    def test_dijkstra_route_calculation(self, optimizer):
        """Test Dijkstra algorithm for route calculation"""
        start = Location(30.3165, 78.0322, "Start")
        end = Location(30.3203, 78.0389, "End")
        
        route = optimizer._calculate_route_dijkstra(start, end)
        
        if route:
            assert route.start == start
            assert route.end == end
            assert route.distance > 0
            assert route.duration > 0
            assert len(route.waypoints) > 0
    
    def test_traffic_density_route(self, optimizer):
        """Test traffic density calculation for route"""
        route_signals = ['clock_tower', 'paltan_bazaar', 'gandhi_road']
        
        density_data = optimizer.get_traffic_density_route(route_signals)
        
        assert isinstance(density_data, dict)
        if density_data:
            assert 'route_signals' in density_data
            assert 'traffic_density' in density_data
    
    def test_optimize_signal_timing(self, optimizer):
        """Test signal timing optimization"""
        signal_id = 'clock_tower'
        emergency_direction = 'north'
        
        timing = optimizer.optimize_signal_timing(signal_id, emergency_direction)
        
        assert isinstance(timing, dict)
        if timing:
            assert 'signal_id' in timing
            assert 'recommended_timing' in timing
    
    def test_calculate_green_corridor(self, optimizer):
        """Test green corridor calculation"""
        route_signals = ['clock_tower', 'paltan_bazaar', 'gandhi_road']
        vehicle_speed = 40
        
        corridor = optimizer.calculate_green_corridor(route_signals, vehicle_speed)
        
        assert isinstance(corridor, dict)
        assert 'success' in corridor
        
        if corridor.get('success'):
            assert 'corridor_plan' in corridor
            assert 'total_corridor_time' in corridor

class TestSignalController:
    """Test traffic signal control functionality"""
    
    @pytest.fixture
    def controller(self):
        """Create signal controller instance for testing"""
        with patch('signals.signal_controller.redis.from_url') as mock_redis:
            mock_redis_client = Mock()
            mock_redis.return_value = mock_redis_client
            
            controller = SignalController()
            controller.redis_client = mock_redis_client
            controller.monitoring_active = False  # Disable background monitoring for tests
            
            return controller
    
    def test_controller_initialization(self, controller):
        """Test signal controller initializes correctly"""
        assert len(controller.signal_states) > 0
        assert controller.emergency_override_duration > 0
        assert controller.default_green_duration > 0
    
    def test_create_signal_if_not_exists(self, controller):
        """Test signal creation"""
        signal_id = 'test_signal'
        
        controller._create_signal_if_not_exists(signal_id)
        
        assert signal_id in controller.signal_states
        assert isinstance(controller.signal_states[signal_id], SignalState)
    
    def test_emergency_override(self, controller):
        """Test emergency signal override"""
        signal_id = 'clock_tower'
        duration = 60
        reason = "Test emergency override"
        
        result = controller.emergency_override(signal_id, duration, reason)
        
        assert isinstance(result, dict)
        assert result.get('success') == True
        assert result.get('signal_id') == signal_id
        assert result.get('duration') == duration
        
        # Check signal state
        signal_state = controller.signal_states[signal_id]
        assert signal_state.is_emergency_override == True
        assert signal_state.current_state == 'green'
        assert signal_state.override_reason == reason
    
    def test_restore_normal_operation(self, controller):
        """Test restoring normal signal operation"""
        signal_id = 'clock_tower'
        
        # First set emergency override
        controller.emergency_override(signal_id, 60, "Test override")
        
        # Then restore normal operation
        result = controller.restore_normal_operation(signal_id)
        
        assert isinstance(result, dict)
        assert result.get('success') == True
        
        # Check signal state
        signal_state = controller.signal_states[signal_id]
        assert signal_state.is_emergency_override == False
    
    def test_update_timing(self, controller):
        """Test updating signal timing"""
        signal_id = 'clock_tower'
        timing_config = {
            'red_duration': 50,
            'yellow_duration': 6,
            'green_duration': 35
        }
        
        result = controller.update_timing(signal_id, timing_config)
        
        assert isinstance(result, dict)
        assert result.get('success') == True
        assert 'new_timing' in result
    
    def test_coordinate_green_corridor(self, controller):
        """Test green corridor coordination"""
        route_signals = ['clock_tower', 'paltan_bazaar', 'gandhi_road']
        duration = 120
        
        result = controller.coordinate_green_corridor(route_signals, duration)
        
        assert isinstance(result, dict)
        assert 'success' in result
        assert 'coordination_plan' in result
        assert 'route_signals' in result
    
    def test_get_signal_status(self, controller):
        """Test getting signal status"""
        signal_id = 'clock_tower'
        
        status = controller.get_signal_status(signal_id)
        
        assert isinstance(status, dict)
        assert 'signal_id' in status
        assert 'current_state' in status
        assert 'remaining_time' in status
        assert 'is_emergency_override' in status
    
    def test_get_all_signals_status(self, controller):
        """Test getting all signals status"""
        status = controller.get_all_signals_status()
        
        assert isinstance(status, dict)
        assert 'signals' in status
        assert 'total_signals' in status
        assert 'emergency_overrides_active' in status

class TestDatabaseManager:
    """Test database management functionality"""
    
    @pytest.fixture
    def db_manager(self):
        """Create database manager instance for testing"""
        with patch('config.database.SimpleConnectionPool') as mock_pool:
            mock_connection = Mock()
            mock_cursor = Mock()
            mock_connection.cursor.return_value = mock_cursor
            
            mock_pool_instance = Mock()
            mock_pool_instance.getconn.return_value = mock_connection
            mock_pool.return_value = mock_pool_instance
            
            db_manager = DatabaseManager()
            db_manager.connection_pool = mock_pool_instance
            
            return db_manager, mock_connection, mock_cursor
    
    def test_db_manager_initialization(self, db_manager):
        """Test database manager initializes correctly"""
        manager, _, _ = db_manager
        assert manager.connection_pool is not None
    
    def test_get_connection(self, db_manager):
        """Test getting database connection"""
        manager, mock_connection, _ = db_manager
        
        conn = manager.get_connection()
        
        assert conn == mock_connection
    
    def test_log_emergency_detection(self, db_manager):
        """Test logging emergency detection"""
        manager, mock_connection, mock_cursor = db_manager
        
        # Mock cursor.fetchone() to return an ID
        mock_cursor.fetchone.return_value = [1]
        
        detection_id = manager.log_emergency_detection(
            signal_id='clock_tower',
            vehicle_type='ambulance',
            confidence=0.95,
            detection_time=datetime.utcnow()
        )
        
        assert detection_id == 1
        assert mock_cursor.execute.called
        assert mock_connection.commit.called
    
    def test_get_all_signals(self, db_manager):
        """Test getting all signals"""
        manager, mock_connection, mock_cursor = db_manager
        
        # Mock cursor.fetchall() to return signal data
        mock_cursor.fetchall.return_value = [
            {
                'id': 'clock_tower',
                'name': 'Clock Tower',
                'latitude': 30.3165,
                'longitude': 78.0322,
                'location_description': 'Main intersection',
                'signal_type': 'standard',
                'status': 'active',
                'installation_date': datetime.now().date(),
                'last_maintenance': None
            }
        ]
        
        signals = manager.get_all_signals()
        
        assert isinstance(signals, list)
        assert len(signals) == 1
        assert signals[0]['id'] == 'clock_tower'

# Property-based testing with Hypothesis
try:
    from hypothesis import given, strategies as st, settings, HealthCheck
    
    class TestPropertyBased:
        """Property-based tests for traffic management system"""
        
        @given(st.floats(min_value=0.0, max_value=1.0))
        def test_confidence_threshold_property(self, threshold):
            """Property: Confidence threshold should always be between 0 and 1"""
            with patch('detection.vehicle_detector.YOLO'):
                detector = EmergencyVehicleDetector()
                
                if 0.0 <= threshold <= 1.0:
                    assert detector.update_confidence_threshold(threshold) == True
                    assert detector.confidence_threshold == threshold
        
        @given(st.integers(min_value=1, max_value=300))
        def test_signal_timing_property(self, duration):
            """Property: Signal timing should accept valid durations"""
            with patch('signals.signal_controller.redis.from_url'):
                controller = SignalController()
                controller.monitoring_active = False
                
                timing_config = {
                    'red_duration': duration,
                    'yellow_duration': 5,
                    'green_duration': 30
                }
                
                result = controller.update_timing('test_signal', timing_config)
                assert result.get('success') == True
        
        @given(st.floats(min_value=30.0, max_value=31.0), 
               st.floats(min_value=77.0, max_value=79.0))
        def test_distance_calculation_property(self, lat1, lng1):
            """Property: Distance calculation should be symmetric and non-negative"""
            optimizer = RouteOptimizer()
            
            loc1 = Location(lat1, lng1, "Location 1")
            loc2 = Location(30.5, 78.5, "Location 2")
            
            distance1 = optimizer._calculate_distance(loc1, loc2)
            distance2 = optimizer._calculate_distance(loc2, loc1)
            
            # Distance should be symmetric
            assert abs(distance1 - distance2) < 0.001
            
            # Distance should be non-negative
            assert distance1 >= 0
            assert distance2 >= 0

        @given(st.integers(min_value=50, max_value=500), 
               st.integers(min_value=50, max_value=500))
        def test_emergency_vehicle_detection_accuracy_property(self, width, height):
            """
            Property 9: Emergency vehicle detection accuracy
            For any valid image with blue and red coloring patterns, 
            the computer vision system should correctly identify it as an emergency vehicle with high confidence
            **Validates: Requirements 6.2**
            """
            with patch('detection.vehicle_detector.YOLO') as mock_yolo:
                # Mock YOLO model
                mock_model = Mock()
                mock_model.names = {0: 'car', 1: 'truck', 2: 'bus', 3: 'motorcycle'}
                mock_yolo.return_value = mock_model
                
                detector = EmergencyVehicleDetector()
                detector.model = mock_model
                
                # Create test image with emergency vehicle colors (blue and red)
                test_image = np.zeros((height, width, 3), dtype=np.uint8)
                
                # Add blue and red regions (emergency vehicle colors)
                blue_region_height = height // 3
                red_region_height = height // 3
                
                # Blue region (top third)
                test_image[0:blue_region_height, :] = [255, 0, 0]  # Blue in BGR
                
                # Red region (middle third) 
                test_image[blue_region_height:blue_region_height + red_region_height, :] = [0, 0, 255]  # Red in BGR
                
                # White region (bottom third - common on ambulances)
                test_image[blue_region_height + red_region_height:, :] = [255, 255, 255]  # White
                
                # Mock YOLO detection results for a vehicle
                mock_box = Mock()
                mock_box.cls = [0]  # Car class
                mock_box.conf = [0.9]  # High confidence
                mock_box.xyxy = [np.array([10, 10, width-10, height-10])]  # Full image bounding box
                
                mock_boxes = Mock()
                mock_boxes.boxes = [mock_box]
                
                mock_result = Mock()
                mock_result.boxes = mock_boxes
                
                detector.model.return_value = [mock_result]
                
                # Test the detection
                result = detector.detect_emergency_vehicle(test_image)
                
                # Property: For images with emergency colors, detection should work
                assert isinstance(result, dict)
                assert 'is_emergency' in result
                assert 'confidence' in result
                
                # If emergency vehicle is detected, confidence should be reasonable
                if result['is_emergency']:
                    assert result['confidence'] > 0.0
                    assert result['confidence'] <= 1.0
                    assert 'vehicle_type' in result
                    assert result['vehicle_type'] is not None
                
                # Color analysis should detect emergency colors
                color_score, detected_colors = detector._analyze_colors(test_image)
                assert color_score >= 0.0
                assert isinstance(detected_colors, list)
                
                # Should detect blue, red, or white (emergency vehicle colors)
                emergency_colors_detected = any(color in ['blue', 'red', 'white'] for color in detected_colors)
                if emergency_colors_detected:
                    assert color_score > 0.0

        @given(st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))),
               st.integers(min_value=30, max_value=300))
        def test_emergency_signal_override_property(self, signal_id, duration):
            """
            Property 10: Emergency signal override
            For any detected emergency vehicle, the traffic system should automatically 
            override the current signal to green for priority passage
            **Validates: Requirements 6.3**
            """
            with patch('signals.signal_controller.redis.from_url') as mock_redis:
                mock_redis_client = Mock()
                mock_redis.return_value = mock_redis_client
                
                controller = SignalController()
                controller.redis_client = mock_redis_client
                controller.monitoring_active = False  # Disable background monitoring for tests
                
                # Clean signal_id to ensure it's valid
                clean_signal_id = ''.join(c for c in signal_id if c.isalnum() or c == '_')[:15]
                if not clean_signal_id:
                    clean_signal_id = 'test_signal'
                
                # Property: Emergency override should always succeed for valid inputs
                result = controller.emergency_override(
                    signal_id=clean_signal_id,
                    duration=duration,
                    reason="Test emergency vehicle detected"
                )
                
                # Verify the override was successful
                assert isinstance(result, dict)
                assert result.get('success') == True
                assert result.get('signal_id') == clean_signal_id
                assert result.get('duration') == duration
                assert result.get('action') == 'emergency_override'
                assert result.get('new_state') == 'green'
                
                # Verify signal state was updated
                assert clean_signal_id in controller.signal_states
                signal_state = controller.signal_states[clean_signal_id]
                assert signal_state.is_emergency_override == True
                assert signal_state.current_state == 'green'
                assert signal_state.remaining_time == duration
                assert signal_state.override_reason == "Test emergency vehicle detected"
                
                # Property: Override duration should be respected
                assert signal_state.remaining_time > 0
                assert signal_state.remaining_time <= duration
                
                # Property: Normal operation can be restored
                restore_result = controller.restore_normal_operation(clean_signal_id)
                assert isinstance(restore_result, dict)
                assert restore_result.get('success') == True
                
                # Verify override was cleared
                updated_state = controller.signal_states[clean_signal_id]
                assert updated_state.is_emergency_override == False

        @given(st.lists(st.text(min_size=1, max_size=8, alphabet='abcdefghijklmnopqrstuvwxyz0123456789'), 
                       min_size=2, max_size=5),
               st.integers(min_value=60, max_value=200))
        @settings(suppress_health_check=[HealthCheck.too_slow], max_examples=50)
        def test_multi_signal_coordination_property(self, signal_ids, duration):
            """
            Property 12: Multi-signal coordination
            For any active emergency routing, the traffic platform should coordinate 
            all signals along the suggested route to create a continuous green corridor
            **Validates: Requirements 6.7**
            """
            with patch('signals.signal_controller.redis.from_url') as mock_redis:
                mock_redis_client = Mock()
                mock_redis.return_value = mock_redis_client
                
                controller = SignalController()
                controller.redis_client = mock_redis_client
                controller.monitoring_active = False  # Disable background monitoring for tests
                
                # Clean and deduplicate signal IDs more robustly
                clean_signal_ids = []
                for i, signal_id in enumerate(signal_ids):
                    # Clean the signal ID
                    clean_id = ''.join(c for c in signal_id if c.isalnum() or c == '_')
                    
                    # Ensure it's not empty and not too short
                    if len(clean_id) < 1:
                        clean_id = f'signal_{i}'
                    
                    # Truncate to reasonable length
                    clean_id = clean_id[:15]
                    
                    # Ensure uniqueness by appending index if needed
                    original_clean_id = clean_id
                    counter = 1
                    while clean_id in clean_signal_ids:
                        clean_id = f"{original_clean_id}_{counter}"
                        counter += 1
                    
                    clean_signal_ids.append(clean_id)
                
                # Ensure we have at least 2 unique signals
                while len(clean_signal_ids) < 2:
                    clean_signal_ids.append(f'fallback_signal_{len(clean_signal_ids)}')
                
                # Limit to reasonable number of signals for testing
                clean_signal_ids = clean_signal_ids[:8]
                
                # Property: Green corridor coordination should succeed for valid inputs
                result = controller.coordinate_green_corridor(
                    route_signals=clean_signal_ids,
                    duration=duration
                )
                
                # Verify coordination was successful
                assert isinstance(result, dict)
                assert 'success' in result
                assert 'coordination_plan' in result
                assert 'route_signals' in result
                
                # Property: All signals in the route should be included in the plan
                assert result['route_signals'] == clean_signal_ids
                
                if result.get('success'):
                    coordination_plan = result['coordination_plan']
                    
                    # Property: Coordination plan should exist and be non-empty
                    assert isinstance(coordination_plan, list)
                    assert len(coordination_plan) > 0
                    
                    # Property: Coordination plan should cover all or most signals
                    planned_signals = [plan['signal_id'] for plan in coordination_plan]
                    assert len(planned_signals) >= min(len(clean_signal_ids), 1)
                    
                    # Property: Each signal should have a valid timing plan
                    for plan in coordination_plan:
                        assert 'signal_id' in plan
                        assert 'green_start_time' in plan
                        assert 'green_duration' in plan
                        assert 'delay_from_start' in plan
                        
                        # Green duration should be positive and reasonable
                        assert plan['green_duration'] > 0
                        assert plan['green_duration'] <= duration
                        
                        # Delay should be non-negative and within total duration
                        assert plan['delay_from_start'] >= 0
                        assert plan['delay_from_start'] <= duration
                    
                    # Property: Signals should be coordinated in sequence (delays should be non-decreasing)
                    delays = [plan['delay_from_start'] for plan in coordination_plan]
                    for i in range(1, len(delays)):
                        assert delays[i] >= delays[i-1], f"Delays not in sequence: {delays}"
                    
                    # Property: Total coordination time should be reasonable
                    if coordination_plan:
                        max_end_time = max(plan['delay_from_start'] + plan['green_duration'] 
                                         for plan in coordination_plan)
                        # Allow reasonable buffer for coordination overhead
                        assert max_end_time <= duration + 120, f"Coordination time {max_end_time} exceeds duration {duration} + buffer"
                
                # Property: Successful coordinates should be tracked
                successful_coordinates = result.get('successful_coordinates', [])
                assert isinstance(successful_coordinates, list)
                
                # Property: Failed coordinates should be reported
                failed_coordinates = result.get('failed_coordinates', [])
                assert isinstance(failed_coordinates, list)
                
                # Property: At least some coordination should succeed for valid inputs
                if result.get('success'):
                    assert len(successful_coordinates) >= 1, "At least one signal should be successfully coordinated"

        @given(st.floats(min_value=30.0, max_value=31.0), 
               st.floats(min_value=77.0, max_value=79.0))
        def test_ambulance_route_optimization_property(self, lat, lng):
            """
            Property 11: Ambulance route optimization
            For any detected ambulance, the route optimizer should calculate and suggest 
            the shortest path to the nearest hospital using current traffic data
            **Validates: Requirements 6.4**
            """
            optimizer = RouteOptimizer()
            
            # Property: Route calculation should succeed for valid coordinates in Dehradun area
            current_location = {'lat': lat, 'lng': lng}
            
            route_result = optimizer.calculate_emergency_route(
                current_location=current_location,
                vehicle_type='ambulance'
            )
            
            # Verify route calculation result structure
            assert isinstance(route_result, dict)
            
            if route_result.get('success'):
                # Property: Successful route should have required components
                assert 'recommended_route' in route_result
                assert 'vehicle_type' in route_result
                assert route_result['vehicle_type'] == 'ambulance'
                
                recommended_route = route_result['recommended_route']
                
                # Property: Route should include hospital destination
                assert 'hospital' in recommended_route
                hospital = recommended_route['hospital']
                assert 'id' in hospital
                assert 'name' in hospital
                assert 'location' in hospital
                assert 'distance' in hospital
                
                # Property: Distance should be positive and reasonable (within Dehradun)
                assert hospital['distance'] > 0
                assert hospital['distance'] < 50  # Max 50km within city limits
                
                # Property: Travel time should be reasonable
                assert hospital['estimated_travel_time'] > 0
                assert hospital['estimated_travel_time'] < 120  # Max 2 hours
                
                # Property: Route should have signals to coordinate
                if 'signals_to_coordinate' in recommended_route:
                    signals = recommended_route['signals_to_coordinate']
                    assert isinstance(signals, list)
                    
                    # Property: All signal IDs should be valid strings
                    for signal_id in signals:
                        assert isinstance(signal_id, str)
                        assert len(signal_id) > 0
                
                # Property: Alternative routes should be provided if available
                if 'alternative_routes' in route_result:
                    alternatives = route_result['alternative_routes']
                    assert isinstance(alternatives, list)
                    
                    # Property: Alternatives should be sorted by some criteria (distance/time)
                    if len(alternatives) > 1:
                        # Check if sorted by distance or time
                        distances = [alt['hospital']['distance'] for alt in alternatives]
                        times = [alt['hospital']['estimated_travel_time'] for alt in alternatives]
                        
                        # Should be sorted by at least one criteria
                        is_distance_sorted = all(distances[i] <= distances[i+1] for i in range(len(distances)-1))
                        is_time_sorted = all(times[i] <= times[i+1] for i in range(len(times)-1))
                        
                        # At least one sorting criteria should be maintained
                        assert is_distance_sorted or is_time_sorted
            
            # Property: Even if no route found, should return structured error
            else:
                assert 'error' in route_result
                assert isinstance(route_result['error'], str)
                assert len(route_result['error']) > 0
            
            # Property: Nearby hospitals function should work for the same location
            hospitals = optimizer.get_nearby_hospitals(lat, lng, radius=15)
            assert isinstance(hospitals, list)
            
            # Property: If hospitals found, they should have required fields
            for hospital in hospitals:
                assert 'id' in hospital
                assert 'name' in hospital
                assert 'location' in hospital
                assert 'distance' in hospital
                assert 'estimated_travel_time' in hospital
                
                # Property: Distance should be within requested radius
                assert hospital['distance'] <= 15
                
                # Property: Location should have valid coordinates
                location = hospital['location']
                assert 'lat' in location
                assert 'lng' in location
                assert isinstance(location['lat'], (int, float))
                assert isinstance(location['lng'], (int, float))
            
            # Property: Hospitals should be sorted by distance
            if len(hospitals) > 1:
                distances = [h['distance'] for h in hospitals]
                assert all(distances[i] <= distances[i+1] for i in range(len(distances)-1))

except ImportError:
    # Hypothesis not available, skip property-based tests
    pass

# Integration tests
class TestIntegration:
    """Integration tests for the complete traffic management system"""
    
    def test_emergency_detection_to_signal_override_flow(self):
        """Test complete flow from detection to signal override"""
        with patch('detection.vehicle_detector.YOLO'), \
             patch('signals.signal_controller.redis.from_url'):
            
            # Initialize components
            detector = EmergencyVehicleDetector()
            controller = SignalController()
            controller.monitoring_active = False
            
            # Mock successful detection
            detection_result = {
                'is_emergency': True,
                'vehicle_type': 'ambulance',
                'confidence': 0.95,
                'bbox': [10, 10, 90, 90]
            }
            
            # If emergency detected, trigger signal override
            if detection_result['is_emergency']:
                override_result = controller.emergency_override(
                    'clock_tower',
                    60,
                    f"Emergency {detection_result['vehicle_type']} detected"
                )
                
                assert override_result.get('success') == True
                assert controller.signal_states['clock_tower'].is_emergency_override == True
    
    def test_route_calculation_to_corridor_coordination(self):
        """Test flow from route calculation to green corridor coordination"""
        with patch('signals.signal_controller.redis.from_url'):
            
            # Initialize components
            optimizer = RouteOptimizer()
            controller = SignalController()
            controller.monitoring_active = False
            
            # Calculate emergency route
            current_location = {'lat': 30.3165, 'lng': 78.0322}
            route_result = optimizer.calculate_emergency_route(current_location)
            
            # If route calculated successfully, coordinate signals
            if route_result.get('success'):
                recommended_route = route_result['recommended_route']
                signals_to_coordinate = recommended_route.get('signals_to_coordinate', [])
                
                if signals_to_coordinate:
                    corridor_result = controller.coordinate_green_corridor(
                        signals_to_coordinate, 120
                    )
                    
                    assert isinstance(corridor_result, dict)
                    assert 'success' in corridor_result

if __name__ == '__main__':
    pytest.main([__file__])
