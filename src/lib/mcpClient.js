import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase client
import { supabase } from './supabaseClient.js';

/**
 * MCP (Microservice Communication Protocol) Client for Supabase
 * 
 * This client provides a standardized interface for communicating with Supabase
 * using REST API protocols with proper authentication and error handling.
 */
class MCPClient {
  constructor() {
    this.supabase = supabase;
    this.protocol = 'REST'; // Default protocol is REST
    this.requestTimeout = 30000; // Default timeout in milliseconds
    this.retryAttempts = 3; // Default retry attempts
    this.encryptionEnabled = true; // Default encryption status
  }

  /**
   * Initialize the MCP client with custom configuration
   * @param {Object} config - Configuration options
   */
  initialize(config = {}) {
    this.protocol = config.protocol || this.protocol;
    this.requestTimeout = config.requestTimeout || this.requestTimeout;
    this.retryAttempts = config.retryAttempts || this.retryAttempts;
    this.encryptionEnabled = config.encryptionEnabled !== undefined ? config.encryptionEnabled : this.encryptionEnabled;
    
    console.log(`MCP Client initialized with protocol: ${this.protocol}`);
    return this;
  }

  /**
   * Get data from a Supabase table with filtering
   * @param {string} tableName - Name of the table
   * @param {Object} options - Query options (filters, sorting, pagination)
   * @returns {Promise} - Promise resolving to query results
   */
  async getData(tableName, options = {}) {
    try {
      // Start building the query
      let query = this.supabase.from(tableName).select(options.select || '*');
      
      // Apply filters if provided
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      
      // Apply ordering if provided
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { 
          ascending: options.orderBy.ascending !== false 
        });
      }
      
      // Apply pagination if provided
      if (options.pagination) {
        const { page = 1, pageSize = 10 } = options.pagination;
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;
        query = query.range(start, end);
      }
      
      // Execute the query
      const { data, error } = await query;
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error(`MCP getData error for table ${tableName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Insert data into a Supabase table
   * @param {string} tableName - Name of the table
   * @param {Object|Array} data - Data to insert (object or array of objects)
   * @returns {Promise} - Promise resolving to insert results
   */
  async insertData(tableName, data) {
    try {
      // Generate request ID for tracking
      const requestId = uuidv4();
      console.log(`MCP insertData request ${requestId} started for table ${tableName}`);
      
      const { data: result, error } = await this.supabase
        .from(tableName)
        .insert(data)
        .select();
      
      if (error) throw error;
      
      console.log(`MCP insertData request ${requestId} completed successfully`);
      return { success: true, data: result };
    } catch (error) {
      console.error(`MCP insertData error for table ${tableName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update data in a Supabase table
   * @param {string} tableName - Name of the table
   * @param {Object} filters - Filters to identify records to update
   * @param {Object} data - Data to update
   * @returns {Promise} - Promise resolving to update results
   */
  async updateData(tableName, filters, data) {
    try {
      // Start building the query
      let query = this.supabase.from(tableName).update(data);
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      // Execute the query and return updated records
      const { data: result, error } = await query.select();
      
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error(`MCP updateData error for table ${tableName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete data from a Supabase table
   * @param {string} tableName - Name of the table
   * @param {Object} filters - Filters to identify records to delete
   * @returns {Promise} - Promise resolving to delete results
   */
  async deleteData(tableName, filters) {
    try {
      // Start building the query
      let query = this.supabase.from(tableName).delete();
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      // Execute the query and return deleted records
      const { data: result, error } = await query.select();
      
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error(`MCP deleteData error for table ${tableName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a custom RPC function in Supabase
   * @param {string} functionName - Name of the RPC function
   * @param {Object} params - Parameters to pass to the function
   * @returns {Promise} - Promise resolving to function results
   */
  async executeFunction(functionName, params = {}) {
    try {
      const { data, error } = await this.supabase
        .rpc(functionName, params);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error(`MCP executeFunction error for function ${functionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle authentication with Supabase
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} - Promise resolving to auth results
   */
  async authenticate(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return { success: true, session: data.session, user: data.user };
    } catch (error) {
      console.error('MCP authentication error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current authenticated user
   * @returns {Promise} - Promise resolving to user data
   */
  async getCurrentUser() {
    try {
      const { data, error } = await this.supabase.auth.getUser();
      
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('MCP getCurrentUser error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out the current user
   * @returns {Promise} - Promise resolving to sign out results
   */
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('MCP signOut error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export a singleton instance
const mcpClient = new MCPClient();
export default mcpClient;