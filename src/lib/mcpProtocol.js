import mcpClient from './mcpClient.js';

/**
 * MCP Protocol Handler
 * 
 * Implements different communication protocols for MCP:
 * - REST: Standard HTTP/HTTPS communication
 * - WebSocket: Real-time bidirectional communication
 * - gRPC: High-performance RPC framework (simulated)
 */
class MCPProtocol {
  constructor() {
    this.activeProtocol = 'REST'; // Default protocol
    this.wsConnection = null;
    this.eventListeners = {};
  }

  /**
   * Set the active protocol for MCP communication
   * @param {string} protocol - Protocol type ('REST', 'WebSocket', or 'gRPC')
   * @returns {boolean} - Success status
   */
  setProtocol(protocol) {
    const validProtocols = ['REST', 'WebSocket', 'gRPC'];
    
    if (!validProtocols.includes(protocol)) {
      console.error(`Invalid protocol: ${protocol}. Must be one of: ${validProtocols.join(', ')}`);
      return false;
    }
    
    this.activeProtocol = protocol;
    console.log(`MCP Protocol set to: ${protocol}`);
    
    // Initialize protocol-specific resources
    if (protocol === 'WebSocket') {
      this._initWebSocket();
    } else if (protocol === 'gRPC') {
      this._initGRPC();
    }
    
    return true;
  }

  /**
   * Send a request using the active protocol
   * @param {string} endpoint - Target endpoint or channel
   * @param {string} method - Request method (GET, POST, PUT, DELETE)
   * @param {Object} data - Request payload
   * @param {Object} options - Additional options
   * @returns {Promise} - Promise resolving to response
   */
  async sendRequest(endpoint, method, data = {}, options = {}) {
    switch (this.activeProtocol) {
      case 'REST':
        return this._sendRESTRequest(endpoint, method, data, options);
      case 'WebSocket':
        return this._sendWebSocketRequest(endpoint, method, data, options);
      case 'gRPC':
        return this._sendGRPCRequest(endpoint, method, data, options);
      default:
        throw new Error(`Unsupported protocol: ${this.activeProtocol}`);
    }
  }

  /**
   * Send a REST request to Supabase
   * @private
   */
  async _sendRESTRequest(endpoint, method, data, options) {
    try {
      let result;
      
      switch (method.toUpperCase()) {
        case 'GET':
          result = await mcpClient.getData(endpoint, data);
          break;
        case 'POST':
          result = await mcpClient.insertData(endpoint, data);
          break;
        case 'PUT':
          result = await mcpClient.updateData(endpoint, options.filters || {}, data);
          break;
        case 'DELETE':
          result = await mcpClient.deleteData(endpoint, data);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
      
      return result;
    } catch (error) {
      console.error('REST request error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize WebSocket connection
   * @private
   */
  _initWebSocket() {
    // Check if WebSocket is already initialized
    if (this.wsConnection) {
      return;
    }

    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not found in environment variables');
      }

      // Convert HTTP/HTTPS to WS/WSS
      const wsUrl = supabaseUrl.replace(/^http/, 'ws') + '/realtime/v1/websocket';
      
      // Create WebSocket connection
      this.wsConnection = new WebSocket(wsUrl);
      
      // Set up event handlers
      this.wsConnection.onopen = () => {
        console.log('WebSocket connection established');
        this._triggerEvent('connection', { status: 'connected' });
      };
      
      this.wsConnection.onclose = () => {
        console.log('WebSocket connection closed');
        this._triggerEvent('connection', { status: 'disconnected' });
        this.wsConnection = null;
      };
      
      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
        this._triggerEvent('error', { error });
      };
      
      this.wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this._triggerEvent('message', message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.wsConnection = null;
    }
  }

  /**
   * Send a WebSocket request
   * @private
   */
  async _sendWebSocketRequest(channel, event, data, options) {
    return new Promise((resolve, reject) => {
      if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
        this._initWebSocket();
        
        // If still not connected, reject
        if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection not available'));
          return;
        }
      }
      
      // Generate a unique request ID
      const requestId = Date.now().toString();
      
      // Create message payload
      const message = {
        id: requestId,
        channel,
        event,
        data,
        options
      };
      
      // Set up response handler
      const responseHandler = (response) => {
        if (response.id === requestId) {
          // Remove the event listener
          this.off('message', responseHandler);
          resolve(response);
        }
      };
      
      // Add event listener for response
      this.on('message', responseHandler);
      
      // Set timeout
      const timeout = setTimeout(() => {
        this.off('message', responseHandler);
        reject(new Error('WebSocket request timed out'));
      }, options.timeout || 30000);
      
      // Send the message
      this.wsConnection.send(JSON.stringify(message));
    });
  }

  /**
   * Initialize gRPC client (simulated)
   * @private
   */
  _initGRPC() {
    console.log('Initializing simulated gRPC client');
    // In a real implementation, this would initialize a gRPC client
    // For this example, we'll simulate gRPC behavior
  }

  /**
   * Send a gRPC request (simulated)
   * @private
   */
  async _sendGRPCRequest(service, method, data, options) {
    console.log(`Simulating gRPC request to ${service}.${method}`);
    
    // Map the gRPC service and method to Supabase operations
    try {
      let result;
      
      switch (method) {
        case 'get':
          result = await mcpClient.getData(service, data);
          break;
        case 'create':
          result = await mcpClient.insertData(service, data);
          break;
        case 'update':
          result = await mcpClient.updateData(service, options.filters || {}, data);
          break;
        case 'delete':
          result = await mcpClient.deleteData(service, data);
          break;
        case 'execute':
          result = await mcpClient.executeFunction(service, data);
          break;
        default:
          throw new Error(`Unsupported gRPC method: ${method}`);
      }
      
      return result;
    } catch (error) {
      console.error('gRPC request error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback to remove
   */
  off(event, callback) {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event] = this.eventListeners[event].filter(
      cb => cb !== callback
    );
  }

  /**
   * Trigger an event
   * @private
   */
  _triggerEvent(event, data) {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} event handler:`, error);
      }
    });
  }
}

// Create and export a singleton instance
const mcpProtocol = new MCPProtocol();
export default mcpProtocol;