import CryptoJS from 'crypto-js';
import { supabase } from './supabaseClient.js';

/**
 * MCP Security Handler
 * 
 * Provides security features for MCP-Supabase integration:
 * - Data encryption/decryption
 * - Token management
 * - Permission control
 */
class MCPSecurity {
  constructor() {
    this.encryptionKey = import.meta.env?.VITE_ENCRYPTION_KEY || 'default-key-replace-in-production';
    this.tokenExpiry = 3600; // Default token expiry in seconds (1 hour)
    this.permissionCache = new Map();
  }

  /**
   * Encrypt sensitive data
   * @param {Object|string} data - Data to encrypt
   * @returns {string} - Encrypted data string
   */
  encrypt(data) {
    try {
      const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
      return CryptoJS.AES.encrypt(dataString, this.encryptionKey).toString();
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * @param {string} encryptedData - Encrypted data string
   * @returns {Object|string} - Decrypted data
   */
  decrypt(encryptedData) {
    try {
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      // Try to parse as JSON, return as string if not valid JSON
      try {
        return JSON.parse(decryptedText);
      } catch {
        return decryptedText;
      }
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure hash for data verification
   * @param {Object|string} data - Data to hash
   * @returns {string} - Hash string
   */
  generateHash(data) {
    const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
    return CryptoJS.SHA256(dataString).toString();
  }

  /**
   * Verify data integrity using hash
   * @param {Object|string} data - Data to verify
   * @param {string} hash - Hash to compare against
   * @returns {boolean} - Verification result
   */
  verifyHash(data, hash) {
    const generatedHash = this.generateHash(data);
    return generatedHash === hash;
  }

  /**
   * Get current user's access token
   * @returns {string|null} - Access token or null if not authenticated
   */
  async getAccessToken() {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Refresh the access token
   * @returns {Object} - Result with new token or error
   */
  async refreshToken() {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) throw error;
      return { 
        success: true, 
        token: data.session?.access_token,
        expires_at: data.session?.expires_at
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has permission for a specific action
   * @param {string} userId - User ID
   * @param {string} resource - Resource name (e.g., 'products', 'orders')
   * @param {string} action - Action name (e.g., 'read', 'write', 'delete')
   * @returns {Promise<boolean>} - Whether user has permission
   */
  async hasPermission(userId, resource, action) {
    // Check cache first
    const cacheKey = `${userId}:${resource}:${action}`;
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey);
    }
    
    try {
      // Get user's role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, permissions')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      
      // Admin role has all permissions
      if (userData.role === 'admin') {
        this.permissionCache.set(cacheKey, true);
        return true;
      }
      
      // Check user's specific permissions if available
      if (userData.permissions) {
        try {
          const permissions = typeof userData.permissions === 'string' 
            ? JSON.parse(userData.permissions) 
            : userData.permissions;
          
          // Check if user has the specific permission
          const hasPermission = permissions[resource]?.includes(action) || false;
          this.permissionCache.set(cacheKey, hasPermission);
          return hasPermission;
        } catch (e) {
          console.error('Error parsing permissions:', e);
        }
      }
      
      // If no specific permissions, check role-based permissions
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('permissions')
        .eq('name', userData.role)
        .single();
      
      if (roleError) {
        // If role not found, default to no permission
        this.permissionCache.set(cacheKey, false);
        return false;
      }
      
      // Check role permissions
      try {
        const rolePermissions = typeof roleData.permissions === 'string'
          ? JSON.parse(roleData.permissions)
          : roleData.permissions;
        
        const hasPermission = rolePermissions[resource]?.includes(action) || false;
        this.permissionCache.set(cacheKey, hasPermission);
        return hasPermission;
      } catch (e) {
        console.error('Error parsing role permissions:', e);
        this.permissionCache.set(cacheKey, false);
        return false;
      }
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Clear permission cache for a user
   * @param {string} userId - User ID to clear cache for, or null for all users
   */
  clearPermissionCache(userId = null) {
    if (userId) {
      // Clear cache for specific user
      const userPrefix = `${userId}:`;
      for (const key of this.permissionCache.keys()) {
        if (key.startsWith(userPrefix)) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.permissionCache.clear();
    }
  }
}

// Create and export a singleton instance
const mcpSecurity = new MCPSecurity();
export default mcpSecurity;