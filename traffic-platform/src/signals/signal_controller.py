import os
import logging
import redis
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import threading
import time
@dataclass
class SignalState:
    signal_id: str
    current_state: str  # 'red', 'yellow', 'green'
    state_start_time: datetime
    remaining_time: int  # seconds
    is_emergency_override: bool = False
    override_reason: str = ""
    normal_timing: Dict = None

@dataclass
class SignalTiming:
    red_duration: int = 45
    yellow_duration: int = 5
    green_duration: int = 30
    cycle_time: int = 80  # Total cycle time

class SignalController:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Redis connection for real-time signal state
        self.redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
        
        # Default signal timings
        self.default_timing = SignalTiming()
        
        # Active signal states
        self.signal_states: Dict[str, SignalState] = {}
        
        # Emergency override settings
        self.emergency_override_duration = int(os.getenv('EMERGENCY_OVERRIDE_DURATION', 60))
        self.default_green_duration = int(os.getenv('DEFAULT_GREEN_DURATION', 30))
        self.default_red_duration = int(os.getenv('DEFAULT_RED_DURATION', 45))
        
        # Traffic density optimization settings
        self.traffic_density_threshold_high = 0.8
        self.traffic_density_threshold_medium = 0.5
        self.adaptive_timing_enabled = True
        
        # Signal timing optimization algorithms
        self.optimization_algorithms = {
            'webster': self._webster_algorithm,
            'adaptive': self._adaptive_algorithm,
            'emergency_priority': self._emergency_priority_algorithm
        }
        
        # Initialize signal monitoring thread
        self.monitoring_active = True
        self.monitor_thread = threading.Thread(target=self._monitor_signals, daemon=True)
        self.monitor_thread.start()
        
        # Initialize default signals
        self._initialize_default_signals()
    
    def _initialize_default_signals(self):
        """Initialize default traffic signals for Dehradun"""
        default_signals = [
            "clock_tower", "paltan_bazaar", "rispana_bridge", "gandhi_road",
            "rajpur_road", "saharanpur_road", "haridwar_road", "mussoorie_road",
            "chakrata_road", "ballupur"
        ]
        
        for signal_id in default_signals:
            self._create_signal_if_not_exists(signal_id)
        
        self.logger.info(f"Initialized {len(default_signals)} traffic signals")
    
    def _create_signal_if_not_exists(self, signal_id: str):
        """Create signal state if it doesn't exist"""
        if signal_id not in self.signal_states:
            # Start with red state
            self.signal_states[signal_id] = SignalState(
                signal_id=signal_id,
                current_state='red',
                state_start_time=datetime.utcnow(),
                remaining_time=self.default_red_duration,
                normal_timing=asdict(self.default_timing)
            )
            
            # Store in Redis
            self._update_redis_state(signal_id)
    
    def emergency_override(self, signal_id: str, duration: int = None, 
                          reason: str = "Emergency vehicle detected") -> Dict:
        """
        Override traffic signal to green for emergency vehicle
        
        Args:
            signal_id: Traffic signal identifier
            duration: Override duration in seconds
            reason: Reason for override
            
        Returns:
            Dict containing override result
        """
        try:
            if duration is None:
                duration = self.emergency_override_duration
            
            # Ensure signal exists
            self._create_signal_if_not_exists(signal_id)
            
            # Get current state
            current_state = self.signal_states[signal_id]
            
            # Store normal timing for restoration
            if not current_state.is_emergency_override:
                current_state.normal_timing = {
                    'state': current_state.current_state,
                    'remaining_time': current_state.remaining_time,
                    'state_start_time': current_state.state_start_time.isoformat()
                }
            
            # Set emergency override
            self.signal_states[signal_id] = SignalState(
                signal_id=signal_id,
                current_state='green',
                state_start_time=datetime.utcnow(),
                remaining_time=duration,
                is_emergency_override=True,
                override_reason=reason,
                normal_timing=current_state.normal_timing
            )
            
            # Update Redis
            self._update_redis_state(signal_id)
            
            # Log the override
            self._log_signal_event(signal_id, 'emergency_override', {
                'duration': duration,
                'reason': reason,
                'previous_state': current_state.current_state
            })
            
            self.logger.info(f"Emergency override activated for signal {signal_id} for {duration}s")
            
            return {
                'success': True,
                'signal_id': signal_id,
                'action': 'emergency_override',
                'new_state': 'green',
                'duration': duration,
                'reason': reason,
                'override_start_time': datetime.utcnow().isoformat(),
                'estimated_end_time': (datetime.utcnow() + timedelta(seconds=duration)).isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error in emergency override for signal {signal_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'signal_id': signal_id
            }
    
    def restore_normal_operation(self, signal_id: str) -> Dict:
        """
        Restore signal to normal operation after emergency override
        
        Args:
            signal_id: Traffic signal identifier
            
        Returns:
            Dict containing restoration result
        """
        try:
            if signal_id not in self.signal_states:
                return {'success': False, 'error': 'Signal not found'}
            
            current_state = self.signal_states[signal_id]
            
            if not current_state.is_emergency_override:
                return {'success': False, 'error': 'Signal is not in emergency override'}
            
            # Restore to normal timing
            if current_state.normal_timing:
                # Calculate how much time has passed since override
                override_duration = (datetime.utcnow() - current_state.state_start_time).total_seconds()
                
                # Start with yellow transition, then restore normal cycle
                self.signal_states[signal_id] = SignalState(
                    signal_id=signal_id,
                    current_state='yellow',
                    state_start_time=datetime.utcnow(),
                    remaining_time=self.default_timing.yellow_duration,
                    is_emergency_override=False,
                    normal_timing=None
                )
            else:
                # Default restoration to red
                self.signal_states[signal_id] = SignalState(
                    signal_id=signal_id,
                    current_state='red',
                    state_start_time=datetime.utcnow(),
                    remaining_time=self.default_red_duration,
                    is_emergency_override=False
                )
            
            # Update Redis
            self._update_redis_state(signal_id)
            
            # Log the restoration
            self._log_signal_event(signal_id, 'normal_operation_restored', {
                'override_duration': override_duration
            })
            
            self.logger.info(f"Normal operation restored for signal {signal_id}")
            
            return {
                'success': True,
                'signal_id': signal_id,
                'action': 'restore_normal',
                'new_state': self.signal_states[signal_id].current_state,
                'restoration_time': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error restoring normal operation for signal {signal_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    def update_timing(self, signal_id: str, timing_config: Dict) -> Dict:
        """
        Update signal timing configuration
        
        Args:
            signal_id: Traffic signal identifier
            timing_config: New timing configuration
            
        Returns:
            Dict containing update result
        """
        try:
            # Ensure signal exists
            self._create_signal_if_not_exists(signal_id)
            
            # Validate timing configuration
            required_fields = ['red_duration', 'yellow_duration', 'green_duration']
            for field in required_fields:
                if field not in timing_config:
                    return {'success': False, 'error': f'Missing required field: {field}'}
                
                if not isinstance(timing_config[field], int) or timing_config[field] <= 0:
                    return {'success': False, 'error': f'Invalid value for {field}'}
            
            # Update timing
            new_timing = SignalTiming(
                red_duration=timing_config['red_duration'],
                yellow_duration=timing_config['yellow_duration'],
                green_duration=timing_config['green_duration'],
                cycle_time=sum([
                    timing_config['red_duration'],
                    timing_config['yellow_duration'], 
                    timing_config['green_duration']
                ])
            )
            
            # Update signal state with new timing
            current_state = self.signal_states[signal_id]
            current_state.normal_timing = asdict(new_timing)
            
            # Store in Redis
            self._update_redis_state(signal_id)
            
            # Log the update
            self._log_signal_event(signal_id, 'timing_updated', timing_config)
            
            self.logger.info(f"Updated timing for signal {signal_id}: {timing_config}")
            
            return {
                'success': True,
                'signal_id': signal_id,
                'action': 'timing_updated',
                'new_timing': asdict(new_timing),
                'update_time': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error updating timing for signal {signal_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    def coordinate_green_corridor(self, route_signals: List[str], 
                                duration: int = 120) -> Dict:
        """
        Coordinate multiple signals for green corridor
        
        Args:
            route_signals: List of signal IDs on the route
            duration: Total corridor duration in seconds
            
        Returns:
            Dict containing coordination result
        """
        try:
            if not route_signals:
                return {'success': False, 'error': 'No signals provided'}
            
            coordination_plan = []
            start_time = datetime.utcnow()
            
            # Calculate timing for each signal
            signal_interval = max(10, duration // len(route_signals))  # At least 10s per signal
            
            for i, signal_id in enumerate(route_signals):
                # Ensure signal exists
                self._create_signal_if_not_exists(signal_id)
                
                # Calculate when this signal should turn green
                green_start_delay = i * signal_interval
                green_start_time = start_time + timedelta(seconds=green_start_delay)
                green_duration = min(60, duration - green_start_delay)
                
                if green_duration > 0:
                    coordination_plan.append({
                        'signal_id': signal_id,
                        'green_start_time': green_start_time,
                        'green_duration': green_duration,
                        'delay_from_start': green_start_delay
                    })
            
            # Execute coordination plan
            successful_coordinates = []
            failed_coordinates = []
            
            for plan in coordination_plan:
                # For immediate execution (first signal) or schedule for later
                if plan['delay_from_start'] == 0:
                    # Immediate override for first signal
                    result = self.emergency_override(
                        plan['signal_id'],
                        plan['green_duration'],
                        f"Green corridor coordination - Signal 1 of {len(route_signals)}"
                    )
                else:
                    # Schedule future override (in real implementation, this would use a scheduler)
                    result = self._schedule_signal_override(
                        plan['signal_id'],
                        plan['green_start_time'],
                        plan['green_duration'],
                        f"Green corridor coordination - Scheduled override"
                    )
                
                if result.get('success'):
                    successful_coordinates.append(plan['signal_id'])
                else:
                    failed_coordinates.append({
                        'signal_id': plan['signal_id'],
                        'error': result.get('error', 'Unknown error')
                    })
            
            # Log coordination
            self._log_signal_event('corridor_coordination', 'green_corridor_activated', {
                'route_signals': route_signals,
                'duration': duration,
                'successful_signals': successful_coordinates,
                'failed_signals': failed_coordinates
            })
            
            return {
                'success': len(successful_coordinates) > 0,
                'coordination_id': f"corridor_{int(start_time.timestamp())}",
                'route_signals': route_signals,
                'coordination_plan': coordination_plan,
                'successful_coordinates': successful_coordinates,
                'failed_coordinates': failed_coordinates,
                'start_time': start_time.isoformat(),
                'estimated_end_time': (start_time + timedelta(seconds=duration)).isoformat(),
                'total_duration': duration
            }
            
        except Exception as e:
            self.logger.error(f"Error coordinating green corridor: {e}")
            return {'success': False, 'error': str(e)}
    
    def _schedule_signal_override(self, signal_id: str, start_time: datetime, 
                                duration: int, reason: str) -> Dict:
        """
        Schedule a future signal override (simplified implementation)
        In production, this would use a proper job scheduler
        """
        try:
            # Store scheduled override in Redis
            schedule_key = f"scheduled_override:{signal_id}:{int(start_time.timestamp())}"
            schedule_data = {
                'signal_id': signal_id,
                'start_time': start_time.isoformat(),
                'duration': duration,
                'reason': reason,
                'status': 'scheduled'
            }
            
            self.redis_client.setex(
                schedule_key,
                duration + 300,  # Keep for 5 minutes after completion
                json.dumps(schedule_data)
            )
            
            return {
                'success': True,
                'signal_id': signal_id,
                'scheduled_time': start_time.isoformat(),
                'duration': duration,
                'schedule_id': schedule_key
            }
            
        except Exception as e:
            self.logger.error(f"Error scheduling signal override: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_signal_status(self, signal_id: str) -> Dict:
        """Get current status of a traffic signal"""
        try:
            if signal_id not in self.signal_states:
                return {'error': 'Signal not found'}
            
            state = self.signal_states[signal_id]
            
            # Calculate actual remaining time
            elapsed = (datetime.utcnow() - state.state_start_time).total_seconds()
            remaining = max(0, state.remaining_time - elapsed)
            
            return {
                'signal_id': signal_id,
                'current_state': state.current_state,
                'remaining_time': int(remaining),
                'is_emergency_override': state.is_emergency_override,
                'override_reason': state.override_reason,
                'state_start_time': state.state_start_time.isoformat(),
                'last_updated': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting signal status for {signal_id}: {e}")
            return {'error': str(e)}
    
    def get_all_signals_status(self) -> Dict:
        """Get status of all traffic signals"""
        try:
            all_status = {}
            
            for signal_id in self.signal_states:
                all_status[signal_id] = self.get_signal_status(signal_id)
            
            return {
                'signals': all_status,
                'total_signals': len(all_status),
                'emergency_overrides_active': sum(
                    1 for status in all_status.values() 
                    if status.get('is_emergency_override', False)
                ),
                'last_updated': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error getting all signals status: {e}")
            return {'error': str(e)}
    
    def _update_redis_state(self, signal_id: str):
        """Update signal state in Redis"""
        try:
            if signal_id in self.signal_states:
                state = self.signal_states[signal_id]
                redis_key = f"signal_state:{signal_id}"
                
                state_data = {
                    'signal_id': state.signal_id,
                    'current_state': state.current_state,
                    'state_start_time': state.state_start_time.isoformat(),
                    'remaining_time': state.remaining_time,
                    'is_emergency_override': state.is_emergency_override,
                    'override_reason': state.override_reason,
                    'normal_timing': state.normal_timing,
                    'last_updated': datetime.utcnow().isoformat()
                }
                
                self.redis_client.setex(redis_key, 3600, json.dumps(state_data))
                
        except Exception as e:
            self.logger.error(f"Error updating Redis state for {signal_id}: {e}")
    
    def _log_signal_event(self, signal_id: str, event_type: str, event_data: Dict):
        """Log signal events for analytics"""
        try:
            log_entry = {
                'signal_id': signal_id,
                'event_type': event_type,
                'event_data': event_data,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Store in Redis list for recent events
            redis_key = f"signal_events:{signal_id}"
            self.redis_client.lpush(redis_key, json.dumps(log_entry))
            self.redis_client.ltrim(redis_key, 0, 99)  # Keep last 100 events
            self.redis_client.expire(redis_key, 86400)  # Expire after 24 hours
            
        except Exception as e:
            self.logger.error(f"Error logging signal event: {e}")
    
    def _monitor_signals(self):
        """Background thread to monitor and update signal states"""
        while self.monitoring_active:
            try:
                current_time = datetime.utcnow()
                
                for signal_id, state in list(self.signal_states.items()):
                    # Calculate elapsed time
                    elapsed = (current_time - state.state_start_time).total_seconds()
                    
                    # Check if state should change
                    if elapsed >= state.remaining_time:
                        if state.is_emergency_override:
                            # End emergency override
                            self.restore_normal_operation(signal_id)
                        else:
                            # Normal state transition
                            self._transition_to_next_state(signal_id)
                
                # Sleep for 1 second
                time.sleep(1)
                
            except Exception as e:
                self.logger.error(f"Error in signal monitoring: {e}")
                time.sleep(5)  # Wait longer on error
    
    def _transition_to_next_state(self, signal_id: str):
        """Transition signal to next state in normal cycle"""
        try:
            current_state = self.signal_states[signal_id]
            timing = SignalTiming(**current_state.normal_timing) if current_state.normal_timing else self.default_timing
            
            # Determine next state
            if current_state.current_state == 'red':
                next_state = 'green'
                next_duration = timing.green_duration
            elif current_state.current_state == 'green':
                next_state = 'yellow'
                next_duration = timing.yellow_duration
            else:  # yellow
                next_state = 'red'
                next_duration = timing.red_duration
            
            # Update state
            self.signal_states[signal_id] = SignalState(
                signal_id=signal_id,
                current_state=next_state,
                state_start_time=datetime.utcnow(),
                remaining_time=next_duration,
                is_emergency_override=False,
                normal_timing=current_state.normal_timing
            )
            
            # Update Redis
            self._update_redis_state(signal_id)
            
        except Exception as e:
            self.logger.error(f"Error transitioning signal {signal_id}: {e}")
    
    def shutdown(self):
        """Shutdown the signal controller"""
        self.monitoring_active = False
        if self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5)
        self.logger.info("Signal controller shutdown complete")
    
    def _webster_algorithm(self, signal_id: str, traffic_data: Dict) -> Dict:
        """
        Webster's algorithm for optimal signal timing
        Calculates optimal cycle time based on traffic flow
        """
        try:
            # Webster's formula: C = (1.5L + 5) / (1 - Y)
            # Where C = cycle time, L = lost time, Y = sum of critical flow ratios
            
            lost_time = 10  # seconds (startup + clearance time)
            
            # Calculate critical flow ratios for each approach
            flow_ratios = []
            for direction in ['north', 'south', 'east', 'west']:
                flow = traffic_data.get(f'{direction}_flow', 0)
                capacity = traffic_data.get(f'{direction}_capacity', 1800)  # vehicles/hour
                ratio = flow / capacity if capacity > 0 else 0
                flow_ratios.append(ratio)
            
            # Sum of critical flow ratios (take max of opposing directions)
            y_critical = max(flow_ratios[0], flow_ratios[1]) + max(flow_ratios[2], flow_ratios[3])
            
            # Prevent division by zero
            if y_critical >= 0.9:
                y_critical = 0.9
            
            # Calculate optimal cycle time
            optimal_cycle = (1.5 * lost_time + 5) / (1 - y_critical)
            optimal_cycle = max(60, min(180, optimal_cycle))  # Constrain between 60-180 seconds
            
            # Distribute green time proportionally
            total_green = optimal_cycle - lost_time
            green_ns = total_green * (max(flow_ratios[0], flow_ratios[1]) / y_critical) if y_critical > 0 else total_green / 2
            green_ew = total_green - green_ns
            
            return {
                'algorithm': 'webster',
                'optimal_cycle_time': int(optimal_cycle),
                'green_north_south': int(green_ns),
                'green_east_west': int(green_ew),
                'yellow_duration': 5,
                'red_clearance': 2
            }
            
        except Exception as e:
            self.logger.error(f"Error in Webster algorithm: {e}")
            return self._get_default_timing()
    
    def _adaptive_algorithm(self, signal_id: str, traffic_data: Dict) -> Dict:
        """
        Adaptive signal timing based on real-time traffic density
        """
        try:
            current_density = traffic_data.get('traffic_density', 0.5)
            queue_length = traffic_data.get('queue_length', 0)
            waiting_time = traffic_data.get('avg_waiting_time', 0)
            
            # Base timing
            base_green = self.default_green_duration
            base_red = self.default_red_duration
            
            # Adjust based on traffic density
            if current_density > self.traffic_density_threshold_high:
                # High density - extend green time
                green_adjustment = 15
                red_adjustment = -10
            elif current_density > self.traffic_density_threshold_medium:
                # Medium density - slight adjustment
                green_adjustment = 5
                red_adjustment = -5
            else:
                # Low density - reduce green time
                green_adjustment = -5
                red_adjustment = 5
            
            # Adjust based on queue length
            if queue_length > 10:
                green_adjustment += 10
            elif queue_length > 5:
                green_adjustment += 5
            
            # Adjust based on waiting time
            if waiting_time > 60:
                green_adjustment += 10
            elif waiting_time > 30:
                green_adjustment += 5
            
            # Calculate final timing
            optimized_green = max(20, min(60, base_green + green_adjustment))
            optimized_red = max(30, min(90, base_red + red_adjustment))
            
            return {
                'algorithm': 'adaptive',
                'green_duration': int(optimized_green),
                'red_duration': int(optimized_red),
                'yellow_duration': 5,
                'cycle_time': int(optimized_green + optimized_red + 5),
                'density_factor': current_density,
                'queue_factor': queue_length,
                'wait_factor': waiting_time
            }
            
        except Exception as e:
            self.logger.error(f"Error in adaptive algorithm: {e}")
            return self._get_default_timing()
    
    def _emergency_priority_algorithm(self, signal_id: str, emergency_data: Dict) -> Dict:
        """
        Emergency vehicle priority algorithm
        Calculates optimal timing for emergency vehicle passage
        """
        try:
            vehicle_type = emergency_data.get('vehicle_type', 'ambulance')
            approach_direction = emergency_data.get('approach_direction', 'north')
            estimated_arrival = emergency_data.get('estimated_arrival_time', 10)  # seconds
            
            # Priority levels
            priority_levels = {
                'ambulance': 1,
                'fire_truck': 1,
                'police': 2
            }
            
            priority = priority_levels.get(vehicle_type, 2)
            
            # Calculate preemption timing
            if priority == 1:  # Highest priority
                preemption_green = 60
                clearance_time = 10
            else:  # Lower priority
                preemption_green = 45
                clearance_time = 5
            
            # Adjust timing based on approach direction
            timing_config = {
                'algorithm': 'emergency_priority',
                'preemption_green': preemption_green,
                'clearance_time': clearance_time,
                'approach_direction': approach_direction,
                'vehicle_type': vehicle_type,
                'priority_level': priority,
                'estimated_arrival': estimated_arrival
            }
            
            # Direction-specific timing
            if approach_direction in ['north', 'south']:
                timing_config.update({
                    'north_south_green': preemption_green,
                    'east_west_green': 0,
                    'north_south_red': 0,
                    'east_west_red': preemption_green + clearance_time
                })
            else:  # east or west
                timing_config.update({
                    'north_south_green': 0,
                    'east_west_green': preemption_green,
                    'north_south_red': preemption_green + clearance_time,
                    'east_west_red': 0
                })
            
            return timing_config
            
        except Exception as e:
            self.logger.error(f"Error in emergency priority algorithm: {e}")
            return self._get_default_timing()
    
    def _get_default_timing(self) -> Dict:
        """Get default signal timing configuration"""
        return {
            'algorithm': 'default',
            'green_duration': self.default_green_duration,
            'red_duration': self.default_red_duration,
            'yellow_duration': 5,
            'cycle_time': self.default_green_duration + self.default_red_duration + 5
        }
    
    def optimize_signal_timing(self, signal_id: str, algorithm: str = 'adaptive', 
                             traffic_data: Dict = None, emergency_data: Dict = None) -> Dict:
        """
        Optimize signal timing using specified algorithm
        
        Args:
            signal_id: Traffic signal identifier
            algorithm: Optimization algorithm ('webster', 'adaptive', 'emergency_priority')
            traffic_data: Current traffic data
            emergency_data: Emergency vehicle data
            
        Returns:
            Optimized timing configuration
        """
        try:
            if algorithm not in self.optimization_algorithms:
                self.logger.warning(f"Unknown algorithm {algorithm}, using default")
                return self._get_default_timing()
            
            # Prepare data based on algorithm
            if algorithm == 'emergency_priority' and emergency_data:
                optimization_data = emergency_data
            else:
                optimization_data = traffic_data or {}
            
            # Run optimization algorithm
            optimized_timing = self.optimization_algorithms[algorithm](signal_id, optimization_data)
            
            # Log optimization
            self._log_signal_event(signal_id, 'timing_optimization', {
                'algorithm': algorithm,
                'input_data': optimization_data,
                'optimized_timing': optimized_timing
            })
            
            return {
                'success': True,
                'signal_id': signal_id,
                'algorithm': algorithm,
                'optimized_timing': optimized_timing,
                'optimization_time': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error optimizing signal timing: {e}")
            return {
                'success': False,
                'error': str(e),
                'signal_id': signal_id
            }
    
    def get_traffic_density_status(self, signal_id: str) -> Dict:
        """
        Get current traffic density status for a signal
        This would integrate with traffic monitoring sensors in production
        """
        try:
            # Simulated traffic density data
            # In production, this would query real traffic sensors
            import random
            
            current_time = datetime.utcnow()
            hour = current_time.hour
            
            # Simulate traffic patterns based on time of day
            if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
                base_density = random.uniform(0.7, 0.9)
            elif 10 <= hour <= 16:  # Daytime
                base_density = random.uniform(0.4, 0.7)
            elif 20 <= hour <= 22:  # Evening
                base_density = random.uniform(0.3, 0.6)
            else:  # Night/early morning
                base_density = random.uniform(0.1, 0.3)
            
            # Add some randomness
            density = max(0.0, min(1.0, base_density + random.uniform(-0.1, 0.1)))
            
            # Calculate derived metrics
            queue_length = int(density * 15)  # 0-15 vehicles
            avg_waiting_time = density * 90  # 0-90 seconds
            
            status = 'low'
            if density > self.traffic_density_threshold_high:
                status = 'high'
            elif density > self.traffic_density_threshold_medium:
                status = 'medium'
            
            return {
                'signal_id': signal_id,
                'traffic_density': round(density, 3),
                'status': status,
                'queue_length': queue_length,
                'avg_waiting_time': round(avg_waiting_time, 1),
                'timestamp': current_time.isoformat(),
                'data_source': 'simulated'  # In production: 'sensor', 'camera', etc.
            }
            
        except Exception as e:
            self.logger.error(f"Error getting traffic density status: {e}")
            return {
                'signal_id': signal_id,
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def enable_adaptive_timing(self, signal_id: str, enable: bool = True) -> Dict:
        """
        Enable or disable adaptive timing for a signal
        
        Args:
            signal_id: Traffic signal identifier
            enable: Whether to enable adaptive timing
            
        Returns:
            Operation result
        """
        try:
            # Store adaptive timing setting in Redis
            redis_key = f"adaptive_timing:{signal_id}"
            self.redis_client.setex(redis_key, 86400, json.dumps({'enabled': enable}))
            
            # Log the change
            self._log_signal_event(signal_id, 'adaptive_timing_changed', {
                'enabled': enable,
                'changed_by': 'system'
            })
            
            return {
                'success': True,
                'signal_id': signal_id,
                'adaptive_timing_enabled': enable,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error setting adaptive timing: {e}")
            return {
                'success': False,
                'error': str(e),
                'signal_id': signal_id
            }
