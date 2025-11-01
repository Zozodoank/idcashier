import { supabase } from './supabaseClient.js';

/**
 * MCP Register Client for handling user registration through the auth-register Edge Function
 * This client provides a standardized interface for communicating with the registration system
 * using REST API protocols with proper authentication and error handling.
 */
class MCPRegisterClient {
  constructor() {
    this.supabase = supabase;
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL;
  }

  /**
   * Register a new user through the auth-register Edge Function
   * @param {Object} userData - User registration data
   * @param {string} userData.name - User's full name
   * @param {string} userData.email - User's email address
   * @param {string} userData.password - User's password
   * @param {string} userData.role - User's role (default: 'owner')
   * @param {string} [userData.tenant_id] - Tenant ID for non-owner users
   * @returns {Promise} - Promise resolving to registration results
   */
  async registerUser(userData) {
    try {
      // Validate required fields
      if (!userData.name || !userData.email || !userData.password) {
        throw new Error('Name, email, and password are required');
      }

      // Call the auth-register Edge Function
      const response = await fetch(`${this.baseUrl}/functions/v1/auth-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role || 'owner',
          tenant_id: userData.tenant_id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('MCP Register Client error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register a new user with trial subscription
   * @param {Object} userData - User registration data
   * @param {number} trialDays - Number of trial days (negative for expired trials)
   * @returns {Promise} - Promise resolving to registration results
   */
  async registerUserWithTrial(userData, trialDays = 7) {
    try {
      // Validate required fields
      if (!userData.name || !userData.email || !userData.password) {
        throw new Error('Name, email, and password are required');
      }

      // Call the auth-register Edge Function with trial days
      const response = await fetch(`${this.baseUrl}/functions/v1/auth-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role || 'owner',
          tenant_id: userData.tenant_id,
          trialDays: trialDays
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration with trial failed');
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('MCP Register Client with Trial error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get registration configuration
   * @returns {Promise} - Promise resolving to configuration data
   */
  async getRegistrationConfig() {
    try {
      // In a real implementation, this might fetch configuration from the server
      return {
        success: true,
        data: {
          minPasswordLength: 6,
          allowedRoles: ['owner', 'cashier'],
          defaultRole: 'owner',
          trialDays: 7
        }
      };
    } catch (error) {
      console.error('MCP Register Config error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export a singleton instance
const mcpRegisterClient = new MCPRegisterClient();
export default mcpRegisterClient;