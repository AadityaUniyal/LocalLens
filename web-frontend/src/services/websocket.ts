/**
 * WebSocket Service for Real-time Communication
 * Handles Socket.IO connections to blood platform backend
 */

import { io, Socket } from 'socket.io-client';

export interface WebSocketEvents {
  // Blood Platform Events
  'new_blood_request': (data: {
    request: any;
    compatible_donors_count: number;
  }) => void;
  
  'donation_confirmed': (data: {
    donation: any;
    request_id: string;
    donor_id: string;
  }) => void;
  
  'emergency_alert': (data: {
    request_id: string;
    blood_type: string;
    donors_alerted: number;
  }) => void;
  
  'request_status_updated': (data: {
    request_id: string;
    status: string;
    message?: string;
  }) => void;
  
  'donor_availability_changed': (data: {
    donor_id: string;
    availability: boolean;
  }) => void;
  
  'match_found': (data: {
    request_id: string;
    donor_id: string;
    compatibility_score: number;
  }) => void;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(private url: string = 'http://localhost:3002') {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
        });

        this.socket.on('connect', () => {
          console.log('✅ WebSocket connected to blood platform');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('❌ WebSocket disconnected:', reason);
          if (reason === 'io server disconnect') {
            // Server initiated disconnect, try to reconnect
            this.reconnect();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ WebSocket connection error:', error);
          this.handleReconnect();
          reject(error);
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`🔄 WebSocket reconnected after ${attemptNumber} attempts`);
          this.reconnectAttempts = 0;
        });

        this.socket.on('reconnect_error', (error) => {
          console.error('❌ WebSocket reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('❌ WebSocket reconnection failed after maximum attempts');
        });

        // Set up event forwarding
        this.setupEventForwarding();

      } catch (error) {
        console.error('❌ Failed to initialize WebSocket:', error);
        reject(error);
      }
    });
  }

  private setupEventForwarding() {
    if (!this.socket) return;

    // Forward all blood platform events to registered listeners
    const events = [
      'new_blood_request',
      'donation_confirmed',
      'emergency_alert',
      'request_status_updated',
      'donor_availability_changed',
      'match_found'
    ];

    events.forEach(event => {
      this.socket!.on(event, (data) => {
        this.emit(event, data);
      });
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.reconnect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Maximum reconnection attempts reached');
    }
  }

  private reconnect() {
    if (this.socket) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 WebSocket disconnected');
    }
  }

  // Join specific rooms for targeted notifications
  joinDonorRoom(donorId: string) {
    if (this.socket) {
      this.socket.emit('join_donor_room', donorId);
      console.log(`🏠 Joined donor room: ${donorId}`);
    }
  }

  joinRecipientRoom(recipientId: string) {
    if (this.socket) {
      this.socket.emit('join_recipient_room', recipientId);
      console.log(`🏠 Joined recipient room: ${recipientId}`);
    }
  }

  joinHospitalRoom(hospitalId: string) {
    if (this.socket) {
      this.socket.emit('join_hospital_room', hospitalId);
      console.log(`🏠 Joined hospital room: ${hospitalId}`);
    }
  }

  // Event listener management
  on<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionId(): string | undefined {
    return this.socket?.id;
  }

  // Send custom events (if needed)
  send(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('⚠️ Cannot send event: WebSocket not connected');
    }
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();

// Auto-connect when imported (optional)
export const connectWebSocket = async (): Promise<WebSocketService> => {
  try {
    await webSocketService.connect();
    return webSocketService;
  } catch (error) {
    console.error('❌ Failed to connect WebSocket:', error);
    throw error;
  }
};

export default webSocketService;