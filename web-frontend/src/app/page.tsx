'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [systemStats, setSystemStats] = useState({
    totalUsers: 1247,
    activeConnections: 89,
    systemUptime: '99.9%',
    lastUpdate: new Date()
  })
  const router = useRouter()

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Simulate real-time system stats updates
  useEffect(() => {
    const statsTimer = setInterval(() => {
      setSystemStats(prev => ({
        ...prev,
        totalUsers: prev.totalUsers + Math.floor(Math.random() * 3),
        activeConnections: 85 + Math.floor(Math.random() * 10),
        lastUpdate: new Date()
      }))
    }, 10000)
    return () => clearInterval(statsTimer)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    if (credentials.username === 'admin' && credentials.password === 'admin') {
      setIsAuthenticated(true)
      setError('')
    } else {
      setError('Invalid credentials. Use admin/admin for demo.')
    }
    setIsLoading(false)
  }

  const platforms = [
    {
      id: 'blood',
      name: 'Blood Donation Platform',
      description: 'Real-time blood donor-recipient matching with emergency response capabilities',
      icon: '🩸',
      status: 'Coming Soon',
      enabled: false,
      route: '/blood'
    },
    {
      id: 'complaint',
      name: 'Government Complaint Management',
      description: 'Citizen complaint filing, tracking, and resolution with multi-authority coordination',
      icon: '📋',
      status: 'Coming Soon',
      enabled: false,
      route: '/complaint'
    },
    {
      id: 'architecture',
      name: 'Architecture Platform',
      description: 'Scalable application framework with DevOps integration and production-ready templates',
      icon: '🏗️',
      status: 'Coming Soon',
      enabled: false,
      route: '/architecture'
    },
    {
      id: 'traffic',
      name: 'Traffic Management System',
      description: 'AI-powered traffic control with emergency vehicle detection and smart routing',
      icon: '🚦',
      status: 'Active',
      enabled: true,
      route: '/traffic'
    }
  ]

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
          <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{animationDelay: '4s'}}></div>
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="glass rounded-3xl shadow-2xl p-8 animate-scaleIn border border-white/20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 animate-pulse-hover">
                <span className="text-3xl">🌐</span>
              </div>
              <h1 className="text-4xl font-bold text-white mb-2 gradient-text">Local Lens</h1>
              <p className="text-blue-200">Multi-Platform Ecosystem</p>
              <div className="mt-4 text-sm text-blue-300">
                {currentTime.toLocaleTimeString()} • System Online
              </div>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-blue-200 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={credentials.username}
                    onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                    className="form-input bg-white/10 border-white/20 text-white placeholder-blue-300"
                    placeholder="Enter username"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-blue-200 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                    className="form-input bg-white/10 border-white/20 text-white placeholder-blue-300"
                    placeholder="Enter password"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              {error && (
                <div className="bg-red-500/20 border border-red-400/30 text-red-200 px-4 py-3 rounded-xl animate-fadeIn">
                  <div className="flex items-center">
                    <span className="mr-2">⚠️</span>
                    {error}
                  </div>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="loading-spinner w-5 h-5 mr-3"></div>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🔐</span>
                    Sign In to Local Lens
                  </>
                )}
              </button>
            </form>
            
            <div className="mt-8 text-center">
              <div className="text-sm text-blue-300 mb-4">
                Demo credentials: <span className="font-mono bg-white/10 px-2 py-1 rounded">admin / admin</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs text-blue-400">
                <div>
                  <div className="font-semibold text-white">{systemStats.totalUsers.toLocaleString()}</div>
                  <div>Total Users</div>
                </div>
                <div>
                  <div className="font-semibold text-white">{systemStats.activeConnections}</div>
                  <div>Active Now</div>
                </div>
                <div>
                  <div className="font-semibold text-white">{systemStats.systemUptime}</div>
                  <div>Uptime</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-mesh opacity-30"></div>
      <div className="absolute inset-0 bg-grid opacity-10"></div>
      
      {/* Header */}
      <header className="glass border-b border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center animate-pulse-hover">
                  <span className="text-2xl">🌐</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Local Lens</h1>
                  <p className="text-blue-300 text-sm">Multi-Platform Ecosystem</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right text-sm">
                <div className="text-white font-medium">Welcome, Admin</div>
                <div className="text-blue-300">{currentTime.toLocaleTimeString()}</div>
              </div>
              <div className="status-online"></div>
              <button
                onClick={() => setIsAuthenticated(false)}
                className="text-blue-300 hover:text-white transition duration-300 flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-white/10"
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="text-center mb-16 animate-fadeIn">
          <h2 className="text-5xl font-bold text-white mb-6 leading-tight">
            Choose Your <span className="gradient-text">Platform</span>
          </h2>
          <p className="text-xl text-blue-200 max-w-4xl mx-auto leading-relaxed">
            Access specialized systems for blood donation management, government complaint handling, 
            architecture services, and intelligent traffic control with real-time monitoring and AI-powered insights.
          </p>
        </div>

        {/* System Status Bar */}
        <div className="mb-12 animate-slideInLeft">
          <div className="glass rounded-2xl p-6 border border-white/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{systemStats.totalUsers.toLocaleString()}</div>
                <div className="text-blue-300 text-sm">Total Users</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{systemStats.activeConnections}</div>
                <div className="text-blue-300 text-sm">Active Now</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">{systemStats.systemUptime}</div>
                <div className="text-blue-300 text-sm">System Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">4</div>
                <div className="text-blue-300 text-sm">Platforms</div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Platform - Traffic Management */}
        <div className="mb-16 animate-scaleIn">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-8 text-white animate-glow">
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8">
                <div className="flex items-center space-x-6 mb-6 lg:mb-0">
                  <div className="text-6xl animate-bounce-hover">🚦</div>
                  <div>
                    <h3 className="text-4xl font-bold mb-2">Traffic Management System</h3>
                    <p className="text-blue-100 text-xl">AI-Powered Smart Traffic Control for Dehradun</p>
                    <div className="flex items-center space-x-4 mt-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-green-200 font-medium">Live & Operational</span>
                      </div>
                      <div className="text-blue-200">•</div>
                      <div className="text-blue-200">Last updated: {systemStats.lastUpdate.toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="glass-dark rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">10</div>
                  <div className="text-blue-200 text-sm">Active Signals</div>
                </div>
                <div className="glass-dark rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">783ms</div>
                  <div className="text-blue-200 text-sm">Avg Response</div>
                </div>
                <div className="glass-dark rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-purple-400">97.5%</div>
                  <div className="text-blue-200 text-sm">System Uptime</div>
                </div>
                <div className="glass-dark rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">24/7</div>
                  <div className="text-blue-200 text-sm">Monitoring</div>
                </div>
              </div>
              
              <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                Real-time emergency vehicle detection with computer vision, intelligent signal coordination, 
                and optimized routing for ambulances, police, and fire trucks across Dehradun's traffic network.
                Advanced AI algorithms ensure minimal disruption while maximizing emergency response efficiency.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => router.push('/traffic')}
                  className="btn-primary flex items-center space-x-2 animate-pulse-hover"
                >
                  <span>🎛️</span>
                  <span>Control Dashboard</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => window.open('http://localhost:5000', '_blank')}
                  className="glass-dark text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center space-x-2"
                >
                  <span>🗺️</span>
                  <span>Live Map View</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white bg-opacity-5 rounded-full -mr-48 -mt-48 animate-float"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white bg-opacity-5 rounded-full -ml-32 -mb-32 animate-float" style={{animationDelay: '3s'}}></div>
          </div>
        </div>

        {/* Other Platforms Grid */}
        <div className="mb-16 animate-slideInRight">
          <h3 className="text-3xl font-bold text-white mb-8 text-center">Other Platforms in Development</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {platforms.filter(p => p.id !== 'traffic').map((platform, index) => (
              <div
                key={platform.id}
                className={`platform-card ${platform.id} ${!platform.enabled ? 'disabled' : ''} 
                           rounded-3xl p-8 text-white cursor-pointer relative overflow-hidden transition-all duration-500 transform hover:scale-105 card-hover`}
                onClick={() => {
                  if (platform.enabled) {
                    router.push(platform.route)
                  }
                }}
                style={{animationDelay: `${index * 0.2}s`}}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-5xl animate-bounce-hover">{platform.icon}</div>
                    <div className="glass-dark px-4 py-2 rounded-full text-sm font-medium">
                      Coming Soon
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-4">{platform.name}</h3>
                  <p className="text-gray-200 leading-relaxed mb-6">
                    {platform.description}
                  </p>
                  
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span>Platform under development</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span>Expected Q2 2024</span>
                    </div>
                  </div>
                </div>
                
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -mr-16 -mt-16 animate-float"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white bg-opacity-5 rounded-full -ml-12 -mb-12 animate-float" style={{animationDelay: '2s'}}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced System Status */}
        <div className="mb-16 animate-fadeIn">
          <div className="glass rounded-3xl p-8 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-8 text-center">Platform Status Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {platforms.map((platform, index) => (
                <div key={platform.id} className="text-center p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300">
                  <div className="text-3xl mb-3">{platform.icon}</div>
                  <div className={`w-4 h-4 rounded-full mx-auto mb-3 ${
                    platform.enabled ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                  }`}></div>
                  <div className="text-sm font-medium text-white mb-1">{platform.name}</div>
                  <div className={`text-xs ${platform.enabled ? 'text-green-400' : 'text-yellow-400'}`}>
                    {platform.enabled ? '🟢 Operational' : '🟡 In Development'}
                  </div>
                  {platform.enabled && (
                    <div className="text-xs text-blue-300 mt-1">
                      Last check: {new Date().toLocaleTimeString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Quick Actions */}
        <div className="text-center animate-slideInLeft">
          <h3 className="text-2xl font-semibold text-white mb-8">Quick Actions</h3>
          <div className="flex flex-wrap justify-center gap-6">
            <button 
              onClick={() => router.push('/traffic')}
              className="btn-primary flex items-center space-x-3"
            >
              <span>🎛️</span>
              <span>Traffic Control Panel</span>
            </button>
            <button 
              onClick={() => window.open('http://localhost:5000', '_blank')}
              className="btn-secondary flex items-center space-x-3"
            >
              <span>🗺️</span>
              <span>Live Traffic Map</span>
            </button>
            <button 
              className="bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 px-8 py-4 rounded-xl cursor-not-allowed opacity-50 flex items-center space-x-3"
              disabled
            >
              <span>🩸</span>
              <span>Blood Platform (Q2 2024)</span>
            </button>
            <button 
              className="bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 px-8 py-4 rounded-xl cursor-not-allowed opacity-50 flex items-center space-x-3"
              disabled
            >
              <span>📋</span>
              <span>Complaint System (Q2 2024)</span>
            </button>
          </div>
        </div>
      </main>

      {/* Enhanced Footer */}
      <footer className="glass border-t border-white/10 mt-20 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🌐</span>
                </div>
                <div>
                  <h4 className="text-white font-bold">Local Lens</h4>
                  <p className="text-blue-300 text-sm">Multi-Platform Ecosystem</p>
                </div>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed">
                Empowering communities with intelligent civic technology solutions for traffic management, 
                healthcare coordination, and government services.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Active Platforms</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center space-x-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Traffic Management System</span>
                </li>
                <li className="flex items-center space-x-2 text-yellow-400">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Blood Donation Platform</span>
                </li>
                <li className="flex items-center space-x-2 text-yellow-400">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Complaint Management</span>
                </li>
                <li className="flex items-center space-x-2 text-yellow-400">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Architecture Platform</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">System Information</h4>
              <div className="space-y-2 text-sm text-blue-200">
                <div>Version: 2.0.0</div>
                <div>Build: {new Date().toLocaleDateString()}</div>
                <div>Environment: Production</div>
                <div>Region: Asia/Kolkata</div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center">
            <p className="text-blue-300 text-sm">
              &copy; 2024 Local Lens Multi-Platform System. All rights reserved.
            </p>
            <p className="text-blue-400 text-xs mt-2">
              Powered by Next.js • Tailwind CSS • TypeScript
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
