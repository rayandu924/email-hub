/**
 * Gmail API Wrapper
 *
 * Handles all Gmail API calls through the MyWallPaper OAuth proxy.
 * Tokens are never exposed - all auth is handled server-side.
 */

const GmailAPI = {
  // Gmail API base path (relative to googleapis.com)
  BASE_PATH: '/gmail/v1/users/me',

  // Required scopes for this addon
  REQUIRED_SCOPES: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
  ],

  // Optional scopes for write operations
  OPTIONAL_SCOPES: [
    'https://www.googleapis.com/auth/gmail.modify',
  ],

  // Reference to MyWallPaper API
  api: null,

  /**
   * Initialize the Gmail API wrapper
   * @param {Object} myWallpaperApi - The MyWallPaper addon API
   */
  init(myWallpaperApi) {
    this.api = myWallpaperApi;
  },

  /**
   * Check if user is connected to Google with Gmail scopes
   * @returns {Promise<boolean>}
   */
  async isConnected() {
    if (!this.api) return false;

    try {
      // First check if oauth API exists
      if (!this.api.oauth || typeof this.api.oauth.isConnected !== 'function') {
        console.log('[GmailAPI] OAuth API not available');
        return false;
      }

      const connected = await this.api.oauth.isConnected('google');
      console.log('[GmailAPI] Google connected:', connected);

      if (!connected) return false;

      // Check if we have Gmail scopes
      const scopes = await this.api.oauth.getScopes('google');
      console.log('[GmailAPI] Current scopes:', scopes);

      if (!scopes || scopes.length === 0) {
        console.log('[GmailAPI] No scopes found');
        return false;
      }

      // Check if any scope includes gmail
      const hasGmailScope = scopes.some(s =>
        s.includes('gmail.readonly') || s.includes('gmail.labels') || s.includes('gmail.modify')
      );

      console.log('[GmailAPI] Has Gmail scopes:', hasGmailScope);
      return hasGmailScope;
    } catch (error) {
      console.error('[GmailAPI] Failed to check connection:', error);
      return false;
    }
  },

  /**
   * Request Gmail permissions
   * Uses oauth.requestScopes() from MyWallPaper SDK
   * @returns {Promise<boolean>} Whether permission was granted
   */
  async requestPermission() {
    if (!this.api) {
      console.error('[GmailAPI] API not initialized');
      return false;
    }

    if (!this.api.oauth || typeof this.api.oauth.requestScopes !== 'function') {
      console.error('[GmailAPI] OAuth API not available');
      return false;
    }

    try {
      console.log('[GmailAPI] Requesting Google OAuth permission...');
      console.log('[GmailAPI] Required scopes:', this.REQUIRED_SCOPES);

      const result = await this.api.oauth.requestScopes(
        'google',
        this.REQUIRED_SCOPES,
        'Accéder à vos emails Gmail pour les afficher dans ce widget'
      );

      console.log('[GmailAPI] oauth.requestScopes result:', result);
      return result;
    } catch (error) {
      console.error('[GmailAPI] Failed to request permission:', error);
      return false;
    }
  },

  /**
   * Make a request to Gmail API via OAuth proxy
   * @param {string} endpoint - API endpoint (relative to /gmail/v1/users/me)
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async request(endpoint, options = {}) {
    if (!this.api) {
      throw new Error('GmailAPI not initialized');
    }

    const fullEndpoint = `${this.BASE_PATH}${endpoint}`;

    try {
      const response = await this.api.oauth.request('google', fullEndpoint, {
        method: options.method || 'GET',
        body: options.body,
        headers: options.headers,
        requiredScopes: this.REQUIRED_SCOPES,
      });

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      console.error('[GmailAPI] Request failed:', endpoint, error);
      throw error;
    }
  },

  /**
   * Get user profile (email address, etc.)
   * @returns {Promise<Object>}
   */
  async getProfile() {
    return await this.request('/profile');
  },

  /**
   * List messages
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Messages list
   */
  async listMessages(options = {}) {
    const params = new URLSearchParams();

    if (options.maxResults) params.set('maxResults', options.maxResults);
    if (options.pageToken) params.set('pageToken', options.pageToken);
    if (options.q) params.set('q', options.q);
    if (options.labelIds) {
      options.labelIds.forEach(id => params.append('labelIds', id));
    }
    if (options.includeSpamTrash) params.set('includeSpamTrash', 'true');

    const query = params.toString();
    const endpoint = `/messages${query ? `?${query}` : ''}`;

    return await this.request(endpoint);
  },

  /**
   * Get a single message
   * @param {string} messageId - Message ID
   * @param {string} format - Format: 'full', 'metadata', 'minimal', 'raw'
   * @returns {Promise<Object>} Message
   */
  async getMessage(messageId, format = 'full') {
    return await this.request(`/messages/${messageId}?format=${format}`);
  },

  /**
   * Get multiple messages in parallel
   * @param {Array<string>} messageIds - Message IDs
   * @param {string} format - Format
   * @returns {Promise<Array>} Messages
   */
  async getMessages(messageIds, format = 'full') {
    const promises = messageIds.map(id => this.getMessage(id, format));
    return await Promise.all(promises);
  },

  /**
   * List labels
   * @returns {Promise<Object>} Labels list
   */
  async listLabels() {
    return await this.request('/labels');
  },

  /**
   * Get a single label
   * @param {string} labelId - Label ID
   * @returns {Promise<Object>} Label
   */
  async getLabel(labelId) {
    return await this.request(`/labels/${labelId}`);
  },

  /**
   * Modify message labels (mark read, archive, etc.)
   * @param {string} messageId - Message ID
   * @param {Object} modifications - Labels to add/remove
   * @returns {Promise<Object>} Updated message
   */
  async modifyMessage(messageId, modifications) {
    return await this.request(`/messages/${messageId}/modify`, {
      method: 'POST',
      body: modifications,
    });
  },

  /**
   * Mark message as read
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async markAsRead(messageId) {
    return await this.modifyMessage(messageId, {
      removeLabelIds: ['UNREAD'],
    });
  },

  /**
   * Mark message as unread
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async markAsUnread(messageId) {
    return await this.modifyMessage(messageId, {
      addLabelIds: ['UNREAD'],
    });
  },

  /**
   * Archive message (remove from INBOX)
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async archive(messageId) {
    return await this.modifyMessage(messageId, {
      removeLabelIds: ['INBOX'],
    });
  },

  /**
   * Star message
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async star(messageId) {
    return await this.modifyMessage(messageId, {
      addLabelIds: ['STARRED'],
    });
  },

  /**
   * Unstar message
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async unstar(messageId) {
    return await this.modifyMessage(messageId, {
      removeLabelIds: ['STARRED'],
    });
  },

  /**
   * Move message to trash
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async trash(messageId) {
    return await this.request(`/messages/${messageId}/trash`, {
      method: 'POST',
    });
  },

  /**
   * Remove message from trash
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async untrash(messageId) {
    return await this.request(`/messages/${messageId}/untrash`, {
      method: 'POST',
    });
  },

  /**
   * Get threads list
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Threads list
   */
  async listThreads(options = {}) {
    const params = new URLSearchParams();

    if (options.maxResults) params.set('maxResults', options.maxResults);
    if (options.pageToken) params.set('pageToken', options.pageToken);
    if (options.q) params.set('q', options.q);
    if (options.labelIds) {
      options.labelIds.forEach(id => params.append('labelIds', id));
    }

    const query = params.toString();
    const endpoint = `/threads${query ? `?${query}` : ''}`;

    return await this.request(endpoint);
  },

  /**
   * Get a thread with all messages
   * @param {string} threadId - Thread ID
   * @param {string} format - Format
   * @returns {Promise<Object>} Thread with messages
   */
  async getThread(threadId, format = 'full') {
    return await this.request(`/threads/${threadId}?format=${format}`);
  },

  /**
   * Build query string for Gmail search
   * @param {Object} filters - Search filters
   * @returns {string} Gmail query string
   */
  buildQuery(filters = {}) {
    const parts = [];

    if (filters.from) parts.push(`from:${filters.from}`);
    if (filters.to) parts.push(`to:${filters.to}`);
    if (filters.subject) parts.push(`subject:${filters.subject}`);
    if (filters.hasAttachment) parts.push('has:attachment');
    if (filters.isUnread) parts.push('is:unread');
    if (filters.isStarred) parts.push('is:starred');
    if (filters.isImportant) parts.push('is:important');
    if (filters.after) parts.push(`after:${filters.after}`);
    if (filters.before) parts.push(`before:${filters.before}`);
    if (filters.newer_than) parts.push(`newer_than:${filters.newer_than}`);
    if (filters.older_than) parts.push(`older_than:${filters.older_than}`);
    if (filters.label) parts.push(`label:${filters.label}`);
    if (filters.search) parts.push(filters.search);

    return parts.join(' ');
  },
};

// Export for use in other scripts
window.GmailAPI = GmailAPI;
