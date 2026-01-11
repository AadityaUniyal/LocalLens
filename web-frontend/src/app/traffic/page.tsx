'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Signal {
  id: string
  name: string
  latitude: number
  longitude: number
  status: string
  current_state: string
  last_updated: string
  traffic_density?: number
  emergency_priority?: boolean
}

interface EmergencyDetection {
  id: number
  timestamp: string
  signal_id: string
  signal_name: string
  vehicle_type: string
  confidence: number
  action_taken: string
  response_time_ms: number
  priority_level?: 'high' | 'medium' | 'low'
}

interface DashboardMetrics {
  active_signals: number
  emergency_overrides: number
  detections_today: number
  avg_response_time: number
  total_vehicles_detected: number
  system_efficiency: number
}

interface SystemAlert {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: Date
}

export default function TrafficDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [signals, setSignals] = useState<Signal[]>([])
  const [emergencyLog, setEmergencyLog] = useState<EmergencyDetection[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    active_signals: 0,
    emergency_overrides: 0,
    detections_today: 0,
    avg_response_time: 0,
    total_vehicles_detected: 0,
    system_efficiency: 0
  })
  const [selectedSignal, setSelectedSignal] = useState('')
  const [overrideDuration, setOverrideDuration] = useState(60)
  const [overrideReason, setOverrideReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [isConnected, setIsConnected] = useState(true)

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Simulate connection status
  useEffect(() => {
    const connectionTimer = setInterval(() => {
      setIsConnected(Math.random() > 0.1) // 90% uptime simulation
    }, 5000)
    return () => clearInterval(connectionTimer)
  }, [])

  // Enhanced simulated data with more realistic values
  useEffect(() => {
    const loadData = async () => {
      try {
        // Simulate API calls with enhanced data
        const mockSignals: Signal[] = [
          { 
            id: 'clock_tower', 
            name: 'Clock Tower', 
            latitude: 30.3165, 
            longitude: 78.0322, 
            status: 'active', 
            current_state: 'green', 
            last_updated: new Date().toISOString(),
            traffic_density: 75,
            emergency_priority: false
          },
          { 
            id: 'paltan_bazaar', 
            name: 'Paltan Bazaar', 
            latitude: 30.3203, 
            longitude: 78.0389, 
            status: 'active', 
            current_state: 'red', 
            last_updated: new Date().toISOString(),
            traffic_density: 90,
            emergency_priority: false
          },
          { 
            id: 'rispana_bridge', 
            name: 'Rispana Bridge', 
            latitude: 30.3456, 
            longitude: 78.0512, 
            status: 'active', 
            current_state: 'yellow', 
            last_updated: new Date().toISOString(),
            traffic_density: 60,
            emergency_priority: false
          },
          { 
            id: 'gandhi_road', 
            name: 'Gandhi Road', 
            latitude: 30.3293, 
            longitude: 78.0428, 
            status: 'active', 
            current_state: 'green', 
            last_updated: new Date().toISOString(),
            traffic_density: 45,
            emergency_priority: false
          },
          { 
            id: 'rajpur_road', 
            name: 'Rajpur Road', 
            latitude: 30.3742, 
            longitude: 78.0664, 
            status: 'active', 
            current_state: 'red', 
            last_updated: new Date().toISOString(),
            traffic_density: 85,
            emergency_priority: false
          },
          { 
            id: 'saharanpur_road', 
            name: 'Saharanpur Road', 
            latitude: 30.3678, 
            longitude: 78.0598, 
            status: 'emergency', 
            current_state: 'green', 
            last_updated: new Date().toISOString(),
            traffic_density: 95,
            emergency_priority: true
          },
          { 
            id: 'haridwar_road', 
            name: 'Haridwar Road', 
            latitude: 30.2987, 
            longitude: 78.0234, 
            status: 'active', 
            current_state: 'green', 
            last_updated: new Date().toISOString(),
            traffic_density: 55,
            emergency_priority: false
          },
          { 
            id: 'mussoorie_road', 
            name: 'Mussoorie Road', 
            latitude: 30.3567, 
            longitude: 78.0789, 
            status: 'active', 
            current_state: 'red', 
            last_updated: new Date().toISOString(),
            traffic_density: 70,
            emergency_priority: false
          },
          { 
            id: 'chakrata_road', 
            name: 'Chakrata Road', 
            latitude: 30.3234, 
            longitude: 78.0456, 
            status: 'active', 
            current_state: 'yellow', 
            last_updated: new Date().toISOString(),
            traffic_density: 65,
            emergency_priority: false
          },
          { 
            id: 'ballupur', 
            name: 'Ballupur Chowk', 
            latitude: 30.3445, 
            longitude: 78.0623, 
            status: 'active', 
            current_state: 'green', 
            last_updated: new Date().toISOString(),
            traffic_density: 40,
            emergency_priority: false
          }
        ]

        const mockEmergencyLog: EmergencyDetection[] = [
          {
            id: 1,
            timestamp: '2024-12-31T14:32:15Z',
            signal_id: 'saharanpur_road',
            signal_name: 'Saharanpur Road',
            vehicle_type: 'ambulance',
            confidence: 0.94,
            action_taken: 'signal_override',
            response_time_ms: 750,
            priority_level: 'high'
          },
          {
            id: 2,
            timestamp: '2024-12-31T13:45:22Z',
            signal_id: 'clock_tower',
            signal_name: 'Clock Tower',
            vehicle_type: 'police',
            confidence: 0.87,
            action_taken: 'route_calculated',
            response_time_ms: 920,
            priority_level: 'medium'
          },
          {
            id: 3,
            timestamp: '2024-12-31T12:18:45Z',
            signal_id: 'paltan_bazaar',
            signal_name: 'Paltan Bazaar',
            vehicle_type: 'fire_truck',
            confidence: 0.91,
            action_taken: 'corridor_created',
            response_time_ms: 680,
            priority_level: 'high'
          },
          {
            id: 4,
            timestamp: '2024-12-31T11:30:12Z',
            signal_id: 'rajpur_road',
            signal_name: 'Rajpur Road',
            vehicle_type: 'ambulance',
            confidence: 0.89,
            action_taken: 'priority_routing',
            response_time_ms: 850,
            priority_level: 'high'
          }
        ]

        const mockMetrics: DashboardMetrics = {
          active_signals: 10,
          emergency_overrides: 1,
          detections_today: 4,
          avg_response_time: 800,
          total_vehicles_detected: 127,
          system_efficiency: 97.5
        }

        // Simulate system alerts
        const mockAlerts: SystemAlert[] = [
          {
            id: '1',
            type: 'success',
            message: 'Emergency vehicle detected and routed successfully',
            timestamp: new Date(Date.now() - 300000) // 5 minutes ago
          },
          {
            id: '2',
            type: 'info',
            message: 'System performance optimization completed',
            timestamp: new Date(Date.now() - 900000) // 15 minutes ago
          }
        ]

        setSignals(mockSignals)
        setEmergencyLog(mockEmergencyLog)
        setMetrics(mockMetrics)
        setSystemAlerts(mockAlerts)
        setLoading(false)
      } catch (err) {
        setError('Failed to load dashboard data')
        setLoading(false)
      }
    }

    loadData()
    
    // Set up real-time updates with more frequent updates
    const interval = setInterval(() => {
      // Simulate real-time signal state changes
      setSignals(prev => prev.map(signal => ({
        ...signal,
        current_state: Math.random() > 0.7 ? 
          ['red', 'yellow', 'green'][Math.floor(Math.random() * 3)] : 
          signal.current_state,
        traffic_density: Math.max(20, Math.min(100, 
          (signal.traffic_density || 50) + (Math.random() - 0.5) * 10
        )),
        last_updated: new Date().toISOString()
      })))

      // Update metrics
      setMetrics(prev => ({
        ...prev,
        avg_response_time: 750 + Math.floor(Math.random() * 100),
        total_vehicles_detected: prev.total_vehicles_detected + Math.floor(Math.random() * 3)
      }))
    }, 3000)
    
    return () => clearInterval(interval)
  }, [])

  const handleSignalOverride = async () => {
    if (!selectedSignal) {
      addAlert('error', 'Please select a signal to override')
      return
    }

    try {
      setLoading(true)
      // In production, this would call the Flask API
      // const response = await fetch(`http://localhost:5000/api/signals/${selectedSignal}/override`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ duration: overrideDuration, reason: overrideReason })
      // })

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Update signal status
      setSignals(prev => prev.map(signal => 
        signal.id === selectedSignal 
          ? { ...signal, status: 'emergency', emergency_priority: true }
          : signal
      ))

      addAlert('success', `Signal ${selectedSignal} overridden for ${overrideDuration} seconds`)
      setSelectedSignal('')
      setOverrideReason('')
      
      // Auto-restore after duration
      setTimeout(() => {
        setSignals(prev => prev.map(signal => 
          signal.id === selectedSignal 
            ? { ...signal, status: 'active', emergency_priority: false }
            : signal
        ))
        addAlert('info', `Signal ${selectedSignal} override expired, returning to normal operation`)
      }, overrideDuration * 1000)
      
    } catch (err) {
      addAlert('error', 'Failed to override signal')
    } finally {
      setLoading(false)
    }
  }

  const addAlert = (type: SystemAlert['type'], message: string) => {
    const newAlert: SystemAlert = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date()
    }
    setSystemAlerts(prev => [newAlert, ...prev.slice(0, 4)]) // Keep only 5 most recent
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setSystemAlerts(prev => prev.filter(alert => alert.id !== newAlert.id))
    }, 5000)
  }

  const getSignalStatusColor = (state: string, status: string) => {
    if (status === 'emergency') return 'bg-orange-500 animate-pulse shadow-lg shadow-orange-500/50'
    switch (state) {
      case 'green': return 'bg-green-500 shadow-lg shadow-green-500/50'
      case 'yellow': return 'bg-yellow-500 shadow-lg shadow-yellow-500/50'
      case 'red': return 'bg-red-500 shadow-lg shadow-red-500/50'
      default: return 'bg-gray-500'
    }
  }

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'ambulance': return '🚑'
      case 'police': return '🚓'
      case 'fire_truck': return '🚒'
      default: return '🚨'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-500'
      case 'medium': return 'text-yellow-500'
      case 'low': return 'text-green-500'
      default: return 'text-gray-500'
    }
  }

  const getTrafficDensityColor = (density: number) => {
    if (density >= 80) return 'bg-red-500'
    if (density >= 60) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
        </div>
        
        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 animate-pulse">
            <span className="text-4xl">🚦</span>
          </div>
          <div className="loading-spinner w-12 h-12 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Traffic Management Dashboard</h2>
          <p className="text-blue-300">Connecting to traffic control systems<span className="loading-dots"></span></p>
          <div className="mt-6 text-sm text-blue-400">
            Initializing real-time monitoring • Syncing signal data • Establishing connections
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-mesh opacity-20"></div>
      <div className="absolute inset-0 bg-grid opacity-10"></div>
      
      {/* System Alerts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {systemAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`notification ${alert.type} animate-slideInRight max-w-sm`}
          >
            <div className="flex items-center space-x-2">
              <span>
                {alert.type === 'success' && '✅'}
                {alert.type === 'error' && '❌'}
                {alert.type === 'warning' && '⚠️'}
                {alert.type === 'info' && 'ℹ️'}
              </span>
              <span className="text-sm">{alert.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="glass border-b border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-6">
              <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Local Lens</span>
              </Link>
              <div className="h-6 border-l border-white/20"></div>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center animate-pulse-hover">
                  <span className="text-2xl">🚦</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Traffic Management</h1>
                  <p className="text-blue-300 text-sm">Dehradun Smart City Initiative</p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 ${
                isConnected ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span>{isConnected ? 'Live System' : 'Connection Lost'}</span>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right text-sm">
                <div className="text-white font-medium">System Time</div>
                <div className="text-blue-300">{currentTime.toLocaleTimeString()}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-white font-medium">Uptime</div>
                <div className="text-green-400">99.9%</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="glass border-b border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: '📊' },
              { id: 'signals', name: 'Signal Control', icon: '🚦' },
              { id: 'emergency', name: 'Emergency Log', icon: '🚨' },
              { id: 'analytics', name: 'Analytics', icon: '📈' },
              { id: 'other-platforms', name: 'Other Platforms', icon: '🔗' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'border-blue-400 text-blue-300 bg-blue-500/10'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-400/30 text-red-200 px-6 py-4 rounded-xl animate-fadeIn">
            <div className="flex items-center">
              <span className="mr-3 text-xl">⚠️</span>
              <div>
                <div className="font-medium">System Error</div>
                <div className="text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Enhanced Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass rounded-2xl p-6 text-center border border-white/20 card-hover">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🚦</span>
                </div>
                <div className="text-4xl font-bold text-blue-400 mb-2">{metrics.active_signals}</div>
                <div className="text-blue-200 text-sm">Active Signals</div>
                <div className="text-xs text-blue-300 mt-1">All systems operational</div>
              </div>
              <div className="glass rounded-2xl p-6 text-center border border-white/20 card-hover">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🚨</span>
                </div>
                <div className="text-4xl font-bold text-orange-400 mb-2">{metrics.emergency_overrides}</div>
                <div className="text-blue-200 text-sm">Emergency Overrides</div>
                <div className="text-xs text-blue-300 mt-1">Currently active</div>
              </div>
              <div className="glass rounded-2xl p-6 text-center border border-white/20 card-hover">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🚑</span>
                </div>
                <div className="text-4xl font-bold text-green-400 mb-2">{metrics.detections_today}</div>
                <div className="text-blue-200 text-sm">Detections Today</div>
                <div className="text-xs text-blue-300 mt-1">Emergency vehicles</div>
              </div>
              <div className="glass rounded-2xl p-6 text-center border border-white/20 card-hover">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <div className="text-4xl font-bold text-purple-400 mb-2">{metrics.avg_response_time}ms</div>
                <div className="text-blue-200 text-sm">Avg Response Time</div>
                <div className="text-xs text-blue-300 mt-1">Real-time average</div>
              </div>
            </div>

            {/* Additional Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">System Efficiency</h3>
                  <span className="text-2xl">📊</span>
                </div>
                <div className="text-3xl font-bold text-green-400 mb-2">{metrics.system_efficiency}%</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${metrics.system_efficiency}%` }}
                  ></div>
                </div>
                <div className="text-xs text-blue-300 mt-2">Optimal performance range</div>
              </div>
              <div className="glass rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Total Vehicles</h3>
                  <span className="text-2xl">🚗</span>
                </div>
                <div className="text-3xl font-bold text-blue-400 mb-2">{metrics.total_vehicles_detected.toLocaleString()}</div>
                <div className="text-blue-200 text-sm">Detected Today</div>
                <div className="text-xs text-blue-300 mt-1">+{Math.floor(Math.random() * 10)} in last hour</div>
              </div>
              <div className="glass rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Network Status</h3>
                  <span className="text-2xl">🌐</span>
                </div>
                <div className="text-3xl font-bold text-green-400 mb-2">Online</div>
                <div className="text-blue-200 text-sm">All systems connected</div>
                <div className="text-xs text-blue-300 mt-1">Latency: 12ms</div>
              </div>
            </div>

            {/* Enhanced Live Map */}
            <div className="glass rounded-2xl p-8 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-white flex items-center space-x-3">
                  <span>🗺️</span>
                  <span>Dehradun Traffic Network</span>
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-blue-300">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live Updates</span>
                  </div>
                  <div className="text-sm text-blue-300">
                    Last sync: {currentTime.toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-xl h-96 flex items-center justify-center border border-white/10">
                <div className="text-center">
                  <div className="text-6xl mb-6 animate-bounce-hover">🗺️</div>
                  <h4 className="text-2xl font-bold text-white mb-4">Interactive Traffic Map</h4>
                  <p className="text-blue-200 mb-6 max-w-md">
                    Real-time visualization of traffic signals, emergency vehicles, and route optimization 
                    across Dehradun's smart traffic network.
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <button 
                      onClick={() => window.open('http://localhost:5000', '_blank')}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <span>🚀</span>
                      <span>Open Full Dashboard</span>
                    </button>
                    <button className="glass-dark text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center space-x-2">
                      <span>📱</span>
                      <span>Mobile View</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Activity Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="glass rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <span>🚦</span>
                    <span>Signal Status</span>
                  </h3>
                  <div className="text-sm text-blue-300">
                    {signals.filter(s => s.status === 'active').length}/{signals.length} Active
                  </div>
                </div>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {signals.slice(0, 6).map((signal) => (
                    <div key={signal.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-300">
                      <div className="flex items-center space-x-4">
                        <div className={`w-4 h-4 rounded-full ${getSignalStatusColor(signal.current_state, signal.status)}`}></div>
                        <div>
                          <div className="font-medium text-white">{signal.name}</div>
                          <div className="text-sm text-blue-300">{signal.id}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm capitalize text-blue-200">{signal.current_state}</span>
                          {signal.emergency_priority && (
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full">Priority</span>
                          )}
                        </div>
                        {signal.traffic_density && (
                          <div className="text-xs text-blue-400 mt-1">
                            Traffic: {signal.traffic_density}%
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <span>🚨</span>
                    <span>Recent Detections</span>
                  </h3>
                  <div className="text-sm text-blue-300">
                    Last 24 hours
                  </div>
                </div>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {emergencyLog.slice(0, 4).map((detection) => (
                    <div key={detection.id} className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getVehicleIcon(detection.vehicle_type)}</span>
                          <div>
                            <span className="font-medium capitalize text-white">{detection.vehicle_type.replace('_', ' ')}</span>
                            {detection.priority_level && (
                              <span className={`ml-2 text-xs px-2 py-1 rounded-full ${getPriorityColor(detection.priority_level)}`}>
                                {detection.priority_level}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-blue-300">
                          {new Date(detection.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-blue-200 mb-2">
                        📍 {detection.signal_name} • Confidence: {(detection.confidence * 100).toFixed(1)}%
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-green-400">
                          ✓ {detection.action_taken.replace('_', ' ')}
                        </div>
                        <div className={`text-sm font-medium ${
                          detection.response_time_ms < 1000 ? 'text-green-400' :
                          detection.response_time_ms < 1500 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {detection.response_time_ms}ms
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signal Control Tab */}
        {activeTab === 'signals' && (
          <div className="space-y-8">
            {/* Manual Override Panel */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">🎛️ Manual Signal Override</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Signal</label>
                  <select
                    value={selectedSignal}
                    onChange={(e) => setSelectedSignal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose a signal...</option>
                    {signals.map((signal) => (
                      <option key={signal.id} value={signal.id}>{signal.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (seconds)</label>
                  <input
                    type="number"
                    value={overrideDuration}
                    onChange={(e) => setOverrideDuration(parseInt(e.target.value))}
                    min="30"
                    max="300"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Manual override"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
                  <button
                    onClick={handleSignalOverride}
                    className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition duration-200 font-medium"
                  >
                    🚨 Override Signal
                  </button>
                </div>
              </div>
            </div>

            {/* All Signals Grid */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">🚦 All Traffic Signals</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {signals.map((signal) => (
                  <div key={signal.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{signal.name}</h4>
                      <div className={`w-4 h-4 rounded-full ${getSignalStatusColor(signal.current_state, signal.status)}`}></div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>ID: {signal.id}</div>
                      <div>State: <span className="capitalize">{signal.current_state}</span></div>
                      <div>Status: <span className="capitalize">{signal.status}</span></div>
                      <div>Location: {signal.latitude.toFixed(4)}, {signal.longitude.toFixed(4)}</div>
                    </div>
                    {signal.status === 'emergency' && (
                      <div className="mt-3 bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded text-sm">
                        🚨 Emergency Override Active
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Emergency Log Tab */}
        {activeTab === 'emergency' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">🚨 Emergency Vehicle Detection Log</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {emergencyLog.map((detection) => (
                    <tr key={detection.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(detection.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getVehicleIcon(detection.vehicle_type)}</span>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {detection.vehicle_type.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {detection.signal_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          detection.confidence >= 0.9 ? 'bg-green-100 text-green-800' :
                          detection.confidence >= 0.8 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {(detection.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {detection.action_taken.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          detection.response_time_ms < 1000 ? 'text-green-600' :
                          detection.response_time_ms < 2000 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {detection.response_time_ms}ms
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">📊 Detection Statistics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Ambulance Detections</span>
                    <span className="font-semibold">1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Police Vehicle Detections</span>
                    <span className="font-semibold">1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Fire Truck Detections</span>
                    <span className="font-semibold">1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average Confidence</span>
                    <span className="font-semibold">90.7%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">⚡ Performance Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Fastest Response</span>
                    <span className="font-semibold text-green-600">680ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Slowest Response</span>
                    <span className="font-semibold text-red-600">920ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>System Uptime</span>
                    <span className="font-semibold text-green-600">99.9%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Signals Online</span>
                    <span className="font-semibold text-green-600">10/10</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">📈 Hourly Activity Chart</h3>
              <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-4">📈</div>
                  <p className="text-gray-600">Real-time analytics chart would be displayed here</p>
                  <p className="text-sm text-gray-500 mt-2">Showing detection patterns, response times, and system performance</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Platforms Tab */}
        {activeTab === 'other-platforms' && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🔗 Other Local Lens Platforms</h2>
              <p className="text-gray-600">Access other specialized systems in the Local Lens ecosystem</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Blood Donation Platform */}
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">🩸</div>
                  <span className="bg-red-400 bg-opacity-30 px-3 py-1 rounded-full text-sm">Coming Soon</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Blood Donation Platform</h3>
                <p className="text-red-100 mb-4">
                  Real-time blood donor-recipient matching with emergency response capabilities and inventory management.
                </p>
                <div className="space-y-2 text-sm text-red-100">
                  <div>• Smart donor-recipient matching</div>
                  <div>• Emergency blood request system</div>
                  <div>• Inventory tracking & alerts</div>
                  <div>• Mobile notifications</div>
                </div>
                <button 
                  className="mt-4 w-full bg-white bg-opacity-20 text-white py-2 px-4 rounded-lg cursor-not-allowed"
                  disabled
                >
                  Platform Under Development
                </button>
              </div>

              {/* Complaint Management Platform */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">📋</div>
                  <span className="bg-blue-400 bg-opacity-30 px-3 py-1 rounded-full text-sm">Coming Soon</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Government Complaint Management</h3>
                <p className="text-blue-100 mb-4">
                  Citizen complaint filing, tracking, and resolution with multi-authority coordination and analytics.
                </p>
                <div className="space-y-2 text-sm text-blue-100">
                  <div>• Multi-category complaint filing</div>
                  <div>• Real-time status tracking</div>
                  <div>• Authority assignment system</div>
                  <div>• Performance analytics</div>
                </div>
                <button 
                  className="mt-4 w-full bg-white bg-opacity-20 text-white py-2 px-4 rounded-lg cursor-not-allowed"
                  disabled
                >
                  Platform Under Development
                </button>
              </div>
            </div>

            {/* Integration Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">🔄 Platform Integration Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium">Traffic Management System</span>
                  </div>
                  <span className="text-green-600 font-medium">✓ Operational</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="font-medium">Blood Donation Platform</span>
                  </div>
                  <span className="text-yellow-600 font-medium">⏳ In Development</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="font-medium">Complaint Management</span>
                  </div>
                  <span className="text-yellow-600 font-medium">⏳ In Development</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="flex flex-wrap justify-center gap-4">
                <Link 
                  href="/"
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition duration-200"
                >
                  🏠 Return to Main Dashboard
                </Link>
                <button 
                  onClick={() => window.open('http://localhost:5000', '_blank')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200"
                >
                  🚦 Open Full Traffic Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
