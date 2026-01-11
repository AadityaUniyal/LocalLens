/**
 * Custom React Hook for Blood Platform Integration
 * Provides state management and API integration for blood platform features
 */

import { useState, useEffect, useCallback } from 'react';
import { ApiService, BloodDonor, BloodRequest, DashboardAnalytics } from '../services/api';
import { webSocketService, WebSocketEvents } from '../services/websocket';

export interface UseBloodPlatformReturn {
  // State
  analytics: DashboardAnalytics | null;
  donors: BloodDonor[];
  requests: BloodRequest[];
  loading: boolean;
  error: string | null;
  connected: boolean;

  // Actions
  refreshAnalytics: () => Promise<void>;
  registerDonor: (donorData: Partial<BloodDonor>) => Promise<{ success: boolean; error?: string }>;
  createBloodRequest: (requestData: Partial<BloodRequest>) => Promise<{ success: boolean; error?: string }>;
  updateDonorAvailability: (donorId: string, availability: boolean) => Promise<{ success: boolean; error?: string }>;
  findCompatibleDonors: (criteria: any) => Promise<{ success: boolean; donors?: BloodDonor[]; error?: string }>;
  confirmDonation: (donationData: any) => Promise<{ success: boolean; error?: string }>;
  
  // Real-time events
  onNewBloodRequest: (callback: WebSocketEvents['new_blood_request']) => void;
  onDonationConfirmed: (callback: WebSocketEvents['donation_confirmed']) => void;
  onEmergencyAlert: (callback: WebSocketEvents['emergency_alert']) => void;
}

export const useBloodPlatform = (): UseBloodPlatformReturn => {
  // State
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [donors, setDonors] = useState<BloodDonor[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        await webSocketService.connect();
        setConnected(true);
        
        // Set up real-time event listeners
        webSocketService.on('new_blood_request', (data) => {
          console.log('🩸 New blood request received:', data);
          // Refresh requests list
          loadBloodRequests();
        });

        webSocketService.on('donation_confirmed', (data) => {
          console.log('✅ Donation confirmed:', data);
          // Refresh analytics and requests
          refreshAnalytics();
          loadBloodRequests();
        });

        webSocketService.on('emergency_alert', (data) => {
          console.log('🚨 Emergency alert:', data);
          // Could trigger notification system here
        });

      } catch (error) {
        console.error('❌ Failed to initialize WebSocket:', error);
        setConnected(false);
      }
    };

    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      webSocketService.disconnect();
      setConnected(false);
    };
  }, []);

  // Load initial data
  useEffect(() => {
    refreshAnalytics();
    loadBloodRequests();
  }, []);

  // API Actions
  const refreshAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await ApiService.getDashboardAnalytics();
      if (response.success && response.data) {
        setAnalytics(response.data);
      } else {
        setError(response.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError('Failed to connect to blood platform');
      console.error('❌ Analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBloodRequests = useCallback(async () => {
    try {
      const response = await ApiService.getBloodRequests({ limit: 50 });
      if (response.success && response.data) {
        setRequests(response.data.requests);
      }
    } catch (err) {
      console.error('❌ Failed to load blood requests:', err);
    }
  }, []);

  const registerDonor = useCallback(async (donorData: Partial<BloodDonor>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.registerDonor(donorData);
      if (response.success) {
        // Refresh analytics to reflect new donor
        await refreshAnalytics();
        return { success: true };
      } else {
        setError(response.error || 'Failed to register donor');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = 'Failed to register donor';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [refreshAnalytics]);

  const createBloodRequest = useCallback(async (requestData: Partial<BloodRequest>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.createBloodRequest(requestData);
      if (response.success) {
        // Refresh data to reflect new request
        await refreshAnalytics();
        await loadBloodRequests();
        return { success: true };
      } else {
        setError(response.error || 'Failed to create blood request');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = 'Failed to create blood request';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [refreshAnalytics, loadBloodRequests]);

  const updateDonorAvailability = useCallback(async (donorId: string, availability: boolean) => {
    try {
      const response = await ApiService.updateDonorAvailability(donorId, { availability });
      if (response.success) {
        await refreshAnalytics();
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to update availability' };
    }
  }, [refreshAnalytics]);

  const findCompatibleDonors = useCallback(async (criteria: {
    blood_type: string;
    location: { lat: number; lng: number };
    radius?: number;
    urgency?: string;
  }) => {
    try {
      const response = await ApiService.findCompatibleDonors(criteria);
      if (response.success && response.data) {
        return { success: true, donors: response.data };
      } else {
        return { success: false, error: response.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to find compatible donors' };
    }
  }, []);

  const confirmDonation = useCallback(async (donationData: {
    request_id: string;
    donor_id: string;
    donation_date: string;
    hospital_id: string;
  }) => {
    try {
      const response = await ApiService.confirmDonation(donationData);
      if (response.success) {
        await refreshAnalytics();
        await loadBloodRequests();
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (err) {
      return { success: false, error: 'Failed to confirm donation' };
    }
  }, [refreshAnalytics, loadBloodRequests]);

  // Real-time event handlers
  const onNewBloodRequest = useCallback((callback: WebSocketEvents['new_blood_request']) => {
    webSocketService.on('new_blood_request', callback);
  }, []);

  const onDonationConfirmed = useCallback((callback: WebSocketEvents['donation_confirmed']) => {
    webSocketService.on('donation_confirmed', callback);
  }, []);

  const onEmergencyAlert = useCallback((callback: WebSocketEvents['emergency_alert']) => {
    webSocketService.on('emergency_alert', callback);
  }, []);

  return {
    // State
    analytics,
    donors,
    requests,
    loading,
    error,
    connected,

    // Actions
    refreshAnalytics,
    registerDonor,
    createBloodRequest,
    updateDonorAvailability,
    findCompatibleDonors,
    confirmDonation,

    // Real-time events
    onNewBloodRequest,
    onDonationConfirmed,
    onEmergencyAlert,
  };
};

export default useBloodPlatform;