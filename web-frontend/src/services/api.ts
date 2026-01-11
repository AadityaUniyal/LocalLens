/**
 * API Service Layer for Local Lens Frontend
 * Handles all backend communication with proper error handling and authentication
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

// API Configuration
const API_CONFIG = {
  BLOOD_PLATFORM: process.env.NEXT_PUBLIC_BLOOD_API_URL || 'http://localhost:3002',
  AUTH_SERVICE: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3001',
  TRAFFIC_PLATFORM: process.env.NEXT_PUBLIC_TRAFFIC_API_URL || 'http://localhost:5000',
  COMPLAINT_PLATFORM: process.env.NEXT_PUBLIC_COMPLAINT_API_URL || 'http://localhost:3003',
};

// Create axios instances for each service
const createApiInstance = (baseURL: string): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor for authentication
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Handle unauthorized access
        localStorage.removeItem('auth_token');
        window.location.href = '/';
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// API instances
export const bloodApi = createApiInstance(API_CONFIG.BLOOD_PLATFORM);
export const authApi = createApiInstance(API_CONFIG.AUTH_SERVICE);
export const trafficApi = createApiInstance(API_CONFIG.TRAFFIC_PLATFORM);
export const complaintApi = createApiInstance(API_CONFIG.COMPLAINT_PLATFORM);

// Type definitions
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BloodDonor {
  id: string;
  name: string;
  email: string;
  phone: string;
  blood_type: string;
  date_of_birth: string;
  location: {
    lat: number;
    lng: number;
  };
  address: string;
  medical_conditions: string[];
  availability: boolean;
  available_until?: string;
  last_donation_date?: string;
  created_at: string;
  updated_at: string;
}

export interface BloodRequest {
  id: string;
  request_id: string;
  name: string;
  email: string;
  phone: string;
  blood_type: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  units_needed: number;
  hospital_id: string;
  hospital_name: string;
  location: {
    lat: number;
    lng: number;
  };
  medical_condition?: string;
  needed_by: string;
  status: 'pending' | 'matched' | 'fulfilled' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface DashboardAnalytics {
  totalDonors: number;
  activeDonors: number;
  totalRequests: number;
  pendingRequests: number;
  completedDonations: number;
  response_rate: number;
  donor_utilization_rate: number;
  bloodTypeDistribution: Array<{
    blood_type: string;
    count: number;
  }>;
  matching_statistics: {
    total_matches: number;
    successful_donations: number;
    average_compatibility_score: number;
    compatibility_rate: string;
  };
  total_blood_banks: number;
  date_range: {
    start_date: string;
    end_date: string;
  };
}

// API Service Class
export class ApiService {
  // Health check for all services
  static async checkServiceHealth(service: 'blood' | 'auth' | 'traffic' | 'complaint') {
    try {
      const api = service === 'blood' ? bloodApi : 
                  service === 'auth' ? authApi :
                  service === 'traffic' ? trafficApi : complaintApi;
      
      const response = await api.get('/health');
      return {
        success: true,
        data: response.data,
        status: 'healthy'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Service unavailable',
        status: 'unhealthy'
      };
    }
  }

  // Blood Platform APIs
  static async getDashboardAnalytics(dateRange?: { start_date: string; end_date: string }): Promise<ApiResponse<DashboardAnalytics>> {
    try {
      const params = dateRange ? { 
        start_date: dateRange.start_date, 
        end_date: dateRange.end_date 
      } : {};
      
      const response = await bloodApi.get('/api/analytics/dashboard', { params });
      return {
        success: true,
        data: response.data.analytics
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch analytics'
      };
    }
  }

  static async registerDonor(donorData: Partial<BloodDonor>): Promise<ApiResponse<BloodDonor>> {
    try {
      const response = await bloodApi.post('/api/donors/register', donorData);
      return {
        success: true,
        data: response.data.donor,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to register donor'
      };
    }
  }

  static async getDonorProfile(donorId: string): Promise<ApiResponse<BloodDonor>> {
    try {
      const response = await bloodApi.get(`/api/donors/profile/${donorId}`);
      return {
        success: true,
        data: response.data.donor
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch donor profile'
      };
    }
  }

  static async updateDonorAvailability(donorId: string, availability: { availability: boolean; available_until?: string }): Promise<ApiResponse> {
    try {
      const response = await bloodApi.put(`/api/donors/${donorId}/availability`, availability);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update availability'
      };
    }
  }

  static async createBloodRequest(requestData: Partial<BloodRequest>): Promise<ApiResponse<BloodRequest>> {
    try {
      const response = await bloodApi.post('/api/requests', requestData);
      return {
        success: true,
        data: response.data.request,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create blood request'
      };
    }
  }

  static async getBloodRequests(filters?: {
    status?: string;
    urgency?: string;
    blood_type?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ requests: BloodRequest[]; pagination: any }>> {
    try {
      const response = await bloodApi.get('/api/requests', { params: filters });
      return {
        success: true,
        data: {
          requests: response.data.requests,
          pagination: response.data.pagination
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch blood requests'
      };
    }
  }

  static async getBloodRequest(requestId: string): Promise<ApiResponse<{ request: BloodRequest; matches: any[] }>> {
    try {
      const response = await bloodApi.get(`/api/requests/${requestId}`);
      return {
        success: true,
        data: {
          request: response.data.request,
          matches: response.data.matches || []
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch blood request'
      };
    }
  }

  static async findCompatibleDonors(searchCriteria: {
    blood_type: string;
    location: { lat: number; lng: number };
    radius?: number;
    urgency?: string;
  }): Promise<ApiResponse<BloodDonor[]>> {
    try {
      const response = await bloodApi.post('/api/matching/find-donors', searchCriteria);
      return {
        success: true,
        data: response.data.donors
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to find compatible donors'
      };
    }
  }

  static async confirmDonation(donationData: {
    request_id: string;
    donor_id: string;
    donation_date: string;
    hospital_id: string;
  }): Promise<ApiResponse> {
    try {
      const response = await bloodApi.post('/api/matching/confirm', donationData);
      return {
        success: true,
        data: response.data.donation,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to confirm donation'
      };
    }
  }

  static async getBloodBanks(location?: string, radius?: number): Promise<ApiResponse<any[]>> {
    try {
      const params = location ? { location, radius } : {};
      const response = await bloodApi.get('/api/blood-banks', { params });
      return {
        success: true,
        data: response.data.blood_banks
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch blood banks'
      };
    }
  }

  static async getBloodBankInventory(bankId: string): Promise<ApiResponse<any>> {
    try {
      const response = await bloodApi.get(`/api/blood-banks/${bankId}/inventory`);
      return {
        success: true,
        data: response.data.inventory
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch inventory'
      };
    }
  }

  static async getBloodTypeDistribution(timeframe: string = '30d', type: string = 'requests'): Promise<ApiResponse<any[]>> {
    try {
      const response = await bloodApi.get('/api/analytics/blood-type-distribution', {
        params: { timeframe, type }
      });
      return {
        success: true,
        data: response.data.distribution
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch blood type distribution'
      };
    }
  }

  static async getInventoryAnalytics(bankId?: string): Promise<ApiResponse<any[]>> {
    try {
      const params = bankId ? { bank_id: bankId } : {};
      const response = await bloodApi.get('/api/analytics/inventory', { params });
      return {
        success: true,
        data: response.data.inventory_summary
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch inventory analytics'
      };
    }
  }

  static async getDonationTrends(timeframe: string = '30d', granularity: string = 'daily'): Promise<ApiResponse<any[]>> {
    try {
      const response = await bloodApi.get('/api/analytics/donation-trends', {
        params: { timeframe, granularity }
      });
      return {
        success: true,
        data: response.data.trends
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch donation trends'
      };
    }
  }

  static async getResponseTimes(timeframe: string = '30d', urgency?: string): Promise<ApiResponse<any[]>> {
    try {
      const params = urgency ? { timeframe, urgency } : { timeframe };
      const response = await bloodApi.get('/api/analytics/response-times', { params });
      return {
        success: true,
        data: response.data.response_times
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch response times'
      };
    }
  }

  static async getPerformanceMetrics(): Promise<ApiResponse<any>> {
    try {
      const response = await bloodApi.get('/api/analytics/performance');
      return {
        success: true,
        data: response.data.performance
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch performance metrics'
      };
    }
  }
}

export default ApiService;