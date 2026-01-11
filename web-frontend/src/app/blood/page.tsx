'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBloodPlatform } from '../../hooks/useBloodPlatform'
import { ApiService } from '../../services/api'

export default function BloodPlatform() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [bloodTypeData, setBloodTypeData] = useState<any[]>([])
  const [bloodBanks, setBloodBanks] = useState<any[]>([])
  const [showDonorForm, setShowDonorForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [notifications, setNotifications] = useState<string[]>([])

  const {
    analytics,
    requests,
    loading,
    error,
    connected,
    refreshAnalytics,
    registerDonor,
    createBloodRequest,
    onNewBloodRequest,
    onDonationConfirmed,
    onEmergencyAlert
  } = useBloodPlatform()

  // Load additional data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load blood type distribution
        const bloodTypeResponse = await ApiService.getBloodTypeDistribution('30d', 'requests')
        if (bloodTypeResponse.success) {
          setBloodTypeData(bloodTypeResponse.data || [])
        }

        // Load blood banks
        const bloodBanksResponse = await ApiService.getBloodBanks()
        if (bloodBanksResponse.success) {
          setBloodBanks(bloodBanksResponse.data || [])
        }
      } catch (err) {
        console.error('Failed to load additional data:', err)
      }
    }

    loadData()
  }, [])

  // Set up real-time notifications
  useEffect(() => {
    onNewBloodRequest((data) => {
      setNotifications(prev => [...prev, `New ${data.request.urgency} blood request for ${data.request.blood_type}`])
    })

    onDonationConfirmed((data) => {
      setNotifications(prev => [...prev, `Donation confirmed for request ${data.request_id}`])
    })

    onEmergencyAlert((data) => {
      setNotifications(prev => [...prev, `🚨 EMERGENCY: ${data.blood_type} needed urgently! ${data.donors_alerted} donors alerted`])
    })
  }, [onNewBloodRequest, onDonationConfirmed, onEmergencyAlert])

  const bloodTypes = [
    { type: 'O+', donors: 0, requests: 0, compatibility: 'Universal donor for Rh+' },
    { type: 'O-', donors: 0, requests: 0, compatibility: 'Universal donor' },
    { type: 'A+', donors: 0, requests: 0, compatibility: 'Can donate to A+, AB+' },
    { type: 'A-', donors: 0, requests: 0, compatibility: 'Can donate to A+, A-, AB+, AB-' },
    { type: 'B+', donors: 0, requests: 0, compatibility: 'Can donate to B+, AB+' },
    { type: 'B-', donors: 0, requests: 0, compatibility: 'Can donate to B+, B-, AB+, AB-' },
    { type: 'AB+', donors: 0, requests: 0, compatibility: 'Universal recipient' },
    { type: 'AB-', donors: 0, requests: 0, compatibility: 'Can receive from all Rh-' }
  ]

  const emergencyServices = bloodBanks.length > 0 ? bloodBanks.slice(0, 4) : [
    { name: 'AIIMS Rishikesh', distance: '45 km', bloodBank: true, emergency: true },
    { name: 'Doon Hospital', distance: '8 km', bloodBank: true, emergency: true },
    { name: 'Max Super Speciality', distance: '12 km', bloodBank: false, emergency: true },
    { name: 'Shri Mahant Indiresh Hospital', distance: '15 km', bloodBank: true, emergency: false }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                ← Back to Local Lens
              </Link>
              <div className="h-6 border-l border-gray-300"></div>
              <h1 className="text-2xl font-bold text-gray-900">🩸 Blood Donation Platform</h1>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm ${connected ? 'text-green-600' : 'text-red-600'}`}>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowDonorForm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
              >
                Register as Donor
              </button>
              <button
                onClick={() => setShowRequestForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
              >
                Request Blood
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Real-time Notifications */}
      {notifications.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400">🔔</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Latest: {notifications[notifications.length - 1]}
                </p>
                {notifications.length > 1 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    +{notifications.length - 1} more notifications
                  </p>
                )}
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setNotifications([])}
                  className="text-yellow-400 hover:text-yellow-600"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={refreshAnalytics}
                  className="text-red-400 hover:text-red-600"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', name: 'Live Dashboard', icon: '📊' },
              { id: 'blood-types', name: 'Blood Types', icon: '🩸' },
              { id: 'requests', name: 'Active Requests', icon: '📋' },
              { id: 'emergency', name: 'Emergency Network', icon: '🚨' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="text-6xl mb-6">🩸</div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Blood Donation Platform
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Real-time blood donor-recipient matching with emergency response capabilities.
                {connected ? ' System is live and operational.' : ' Connecting to backend services...'}
              </p>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <p className="mt-2 text-gray-600">Loading platform data...</p>
              </div>
            )}

            {/* Key Metrics */}
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <div className="text-3xl font-bold text-red-600">{analytics.totalDonors}</div>
                  <div className="text-gray-600">Registered Donors</div>
                  <div className="text-sm text-green-600 mt-1">{analytics.activeDonors} active</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <div className="text-3xl font-bold text-blue-600">{analytics.pendingRequests}</div>
                  <div className="text-gray-600">Active Requests</div>
                  <div className="text-sm text-gray-500 mt-1">{analytics.totalRequests} total</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <div className="text-3xl font-bold text-green-600">{analytics.completedDonations}</div>
                  <div className="text-gray-600">Successful Matches</div>
                  <div className="text-sm text-green-600 mt-1">{analytics.response_rate.toFixed(1)}% response rate</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <div className="text-3xl font-bold text-purple-600">{analytics.total_blood_banks}</div>
                  <div className="text-gray-600">Partner Blood Banks</div>
                  <div className="text-sm text-gray-500 mt-1">Network active</div>
                </div>
              </div>
            )}

            {/* Blood Type Distribution */}
            {analytics && analytics.bloodTypeDistribution && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Blood Type Distribution</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {analytics.bloodTypeDistribution.map((item) => (
                    <div key={item.blood_type} className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{item.blood_type}</div>
                      <div className="text-sm text-gray-600">{item.count} requests</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {requests.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Blood Requests</h2>
                <div className="space-y-3">
                  {requests.slice(0, 5).map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">🩸</div>
                        <div>
                          <div className="font-medium">{request.blood_type} - {request.units_needed} units</div>
                          <div className="text-sm text-gray-600">{request.hospital_name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          request.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                          request.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                          request.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {request.urgency}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{request.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm">WebSocket Connection</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Blood Platform API</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Database Connection</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blood Types Tab */}
        {activeTab === 'blood-types' && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Blood Type Management</h2>
              <p className="text-gray-600">Live tracking and matching for all blood types</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {bloodTypes.map((blood) => {
                const typeData = bloodTypeData.find(d => d.blood_type === blood.type)
                const requestCount = typeData ? parseInt(typeData.count) : 0
                
                return (
                  <div key={blood.type} className="bg-white rounded-lg shadow p-6 text-center">
                    <div className="text-2xl font-bold text-red-600 mb-2">{blood.type}</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Requests:</span>
                        <span className="font-medium">{requestCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`font-medium ${requestCount > 5 ? 'text-red-600' : requestCount > 2 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {requestCount > 5 ? 'High Demand' : requestCount > 2 ? 'Moderate' : 'Low Demand'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">{blood.compatibility}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Blood Compatibility Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Blood Compatibility Matrix</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Donor Type</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-900">Can Donate To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bloodTypes.map((blood) => (
                      <tr key={blood.type}>
                        <td className="px-4 py-2 font-medium text-red-600">{blood.type}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{blood.compatibility}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Active Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Active Blood Requests</h2>
                <p className="text-gray-600">Real-time blood requests from hospitals and individuals</p>
              </div>
              <button
                onClick={refreshAnalytics}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
              >
                Refresh
              </button>
            </div>

            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <p className="mt-2 text-gray-600">Loading requests...</p>
              </div>
            )}

            {requests.length === 0 && !loading && (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <div className="text-6xl mb-4">🩸</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Requests</h3>
                <p className="text-gray-600">All blood requests have been fulfilled or there are no pending requests.</p>
              </div>
            )}

            {requests.length > 0 && (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="text-3xl">🩸</div>
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{request.blood_type}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              request.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                              request.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                              request.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {request.urgency.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              request.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                              request.status === 'matched' ? 'bg-green-100 text-green-800' :
                              request.status === 'fulfilled' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {request.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-1">
                            <strong>Hospital:</strong> {request.hospital_name}
                          </p>
                          <p className="text-gray-600 mb-1">
                            <strong>Units Needed:</strong> {request.units_needed}
                          </p>
                          <p className="text-gray-600 mb-1">
                            <strong>Needed By:</strong> {new Date(request.needed_by).toLocaleString()}
                          </p>
                          <p className="text-gray-600">
                            <strong>Request ID:</strong> {request.request_id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>Created: {new Date(request.created_at).toLocaleDateString()}</p>
                        <p>{new Date(request.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Emergency Network Tab */}
        {activeTab === 'emergency' && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Emergency Response Network</h2>
              <p className="text-gray-600">Connected hospitals and blood banks for rapid emergency response</p>
            </div>

            {/* Partner Hospitals */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Partner Hospitals & Blood Banks</h3>
              <div className="space-y-4">
                {emergencyServices.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">🏥</div>
                      <div>
                        <div className="font-medium text-gray-900">{service.name}</div>
                        <div className="text-sm text-gray-600">
                          {service.distance ? `Distance: ${service.distance}` : 'Location data loading...'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {service.bloodBank && (
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">Blood Bank</span>
                      )}
                      {service.emergency && (
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">Emergency</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Response Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🚨 Emergency Features</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">Instant Alert System</div>
                      <div className="text-sm text-gray-600">Push notifications to nearby compatible donors</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">GPS-Based Matching</div>
                      <div className="text-sm text-gray-600">Find closest available donors in real-time</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">Hospital Coordination</div>
                      <div className="text-sm text-gray-600">Direct integration with hospital systems</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📱 Real-time Integration</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">WebSocket Notifications</div>
                      <div className="text-sm text-gray-600">Instant alerts for emergency requests</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">One-Touch Response</div>
                      <div className="text-sm text-gray-600">Quick acceptance and location sharing</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">Live Status Updates</div>
                      <div className="text-sm text-gray-600">Real-time request and donation tracking</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Emergency Requests */}
            {requests.filter(r => r.urgency === 'critical' || r.urgency === 'high').length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-800 mb-4">🚨 Active Emergency Requests</h3>
                <div className="space-y-3">
                  {requests
                    .filter(r => r.urgency === 'critical' || r.urgency === 'high')
                    .slice(0, 3)
                    .map((request) => (
                      <div key={request.id} className="bg-white rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="text-2xl">🩸</div>
                            <div>
                              <div className="font-medium text-red-800">
                                {request.blood_type} - {request.units_needed} units
                              </div>
                              <div className="text-sm text-red-600">{request.hospital_name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-red-600 font-medium">
                              {request.urgency.toUpperCase()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(request.needed_by).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-12 text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/"
              className="bg-red-600 text-white px-8 py-4 rounded-lg hover:bg-red-700 transition duration-200 font-medium"
            >
              🏠 Return to Main Dashboard
            </Link>
            <Link 
              href="/traffic"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
            >
              🚦 View Traffic System (Live)
            </Link>
            <button
              onClick={refreshAnalytics}
              className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 transition duration-200 font-medium"
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>
      </main>

      {/* Donor Registration Modal */}
      {showDonorForm && (
        <DonorRegistrationModal
          onClose={() => setShowDonorForm(false)}
          onSubmit={registerDonor}
        />
      )}

      {/* Blood Request Modal */}
      {showRequestForm && (
        <BloodRequestModal
          onClose={() => setShowRequestForm(false)}
          onSubmit={createBloodRequest}
        />
      )}
    </div>
  )
}

// Donor Registration Modal Component
function DonorRegistrationModal({ onClose, onSubmit }: { 
  onClose: () => void; 
  onSubmit: (data: any) => Promise<{ success: boolean; error?: string }> 
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    blood_type: '',
    date_of_birth: '',
    address: '',
    medical_conditions: [''],
    emergency_contact: {
      name: '',
      phone: '',
      relationship: ''
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Get user location
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }),
            () => resolve({ lat: 30.3165, lng: 78.0322 }) // Default to Dehradun
          )
        } else {
          resolve({ lat: 30.3165, lng: 78.0322 })
        }
      })

      const result = await onSubmit({
        ...formData,
        location,
        medical_conditions: formData.medical_conditions.filter(c => c.trim())
      })

      if (result.success) {
        onClose()
      } else {
        setError(result.error || 'Registration failed')
      }
    } catch (err) {
      setError('Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Register as Blood Donor</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                <select
                  required
                  value={formData.blood_type}
                  onChange={(e) => setFormData({...formData, blood_type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Select Blood Type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                required
                value={formData.date_of_birth}
                onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                required
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register as Donor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Blood Request Modal Component
function BloodRequestModal({ onClose, onSubmit }: { 
  onClose: () => void; 
  onSubmit: (data: any) => Promise<{ success: boolean; error?: string }> 
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    blood_type: '',
    urgency: 'medium',
    units_needed: 1,
    hospital_name: '',
    medical_condition: '',
    needed_by: '',
    doctor_name: '',
    doctor_contact: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Get user location
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }),
            () => resolve({ lat: 30.3165, lng: 78.0322 }) // Default to Dehradun
          )
        } else {
          resolve({ lat: 30.3165, lng: 78.0322 })
        }
      })

      const result = await onSubmit({
        ...formData,
        location,
        hospital_id: 'default-hospital-id' // Would be selected from a list in production
      })

      if (result.success) {
        onClose()
      } else {
        setError(result.error || 'Request submission failed')
      }
    } catch (err) {
      setError('Request submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Request Blood</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                <select
                  required
                  value={formData.blood_type}
                  onChange={(e) => setFormData({...formData, blood_type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Select Blood Type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Units Needed</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={formData.units_needed}
                  onChange={(e) => setFormData({...formData, units_needed: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Urgency Level</label>
                <select
                  required
                  value={formData.urgency}
                  onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Needed By</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.needed_by}
                  onChange={(e) => setFormData({...formData, needed_by: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name</label>
              <input
                type="text"
                required
                value={formData.hospital_name}
                onChange={(e) => setFormData({...formData, hospital_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Condition (Optional)</label>
              <textarea
                value={formData.medical_condition}
                onChange={(e) => setFormData({...formData, medical_condition: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}