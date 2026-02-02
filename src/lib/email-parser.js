/**
 * Email Parser - Parse Gmail API message format
 *
 * Gmail returns emails in a specific format with headers and body parts.
 * This module handles parsing and decoding.
 */

const EmailParser = {
  /**
   * Parse a Gmail message response into a readable format
   * @param {Object} message - Gmail API message object
   * @returns {Object} Parsed email
   */
  parse(message) {
    const headers = this.parseHeaders(message.payload?.headers || []);
    const body = this.parseBody(message.payload);
    const labels = message.labelIds || [];

    return {
      id: message.id,
      threadId: message.threadId,
      snippet: message.snippet || '',
      internalDate: parseInt(message.internalDate, 10),
      date: new Date(parseInt(message.internalDate, 10)),

      // Headers
      from: this.parseAddress(headers.from),
      to: this.parseAddressList(headers.to),
      cc: this.parseAddressList(headers.cc),
      subject: headers.subject || '(Sans objet)',
      replyTo: headers['reply-to'],

      // Body
      bodyText: body.text,
      bodyHtml: body.html,

      // Labels
      labels,
      isUnread: labels.includes('UNREAD'),
      isStarred: labels.includes('STARRED'),
      isImportant: labels.includes('IMPORTANT'),
      isInbox: labels.includes('INBOX'),
      isDraft: labels.includes('DRAFT'),
      isSent: labels.includes('SENT'),
      isTrash: labels.includes('TRASH'),
      isSpam: labels.includes('SPAM'),

      // Attachments
      attachments: this.parseAttachments(message.payload),
    };
  },

  /**
   * Parse headers array into object
   * @param {Array} headers - Gmail headers array
   * @returns {Object} Headers object
   */
  parseHeaders(headers) {
    const result = {};
    const headerNames = ['from', 'to', 'cc', 'bcc', 'subject', 'date', 'reply-to', 'message-id'];

    for (const header of headers) {
      const name = header.name.toLowerCase();
      if (headerNames.includes(name)) {
        result[name] = header.value;
      }
    }

    return result;
  },

  /**
   * Parse email address string
   * @param {string} addressStr - Email address string (e.g., "John Doe <john@example.com>")
   * @returns {Object} Parsed address
   */
  parseAddress(addressStr) {
    if (!addressStr) return { name: '', email: '' };

    // Match: "Name <email>" or just "email"
    const match = addressStr.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);

    if (match) {
      return {
        name: (match[1] || '').trim(),
        email: (match[2] || '').trim(),
        raw: addressStr,
      };
    }

    return { name: '', email: addressStr.trim(), raw: addressStr };
  },

  /**
   * Parse multiple email addresses
   * @param {string} addressesStr - Comma-separated email addresses
   * @returns {Array} Parsed addresses
   */
  parseAddressList(addressesStr) {
    if (!addressesStr) return [];

    // Split by comma, but not inside quotes
    const addresses = addressesStr.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return addresses.map(addr => this.parseAddress(addr.trim())).filter(a => a.email);
  },

  /**
   * Parse message body from payload
   * @param {Object} payload - Gmail message payload
   * @returns {Object} Body text and html
   */
  parseBody(payload) {
    const result = { text: '', html: '' };

    if (!payload) return result;

    // Simple body (no parts)
    if (payload.body?.data) {
      const decoded = this.decodeBase64(payload.body.data);
      if (payload.mimeType === 'text/html') {
        result.html = decoded;
      } else {
        result.text = decoded;
      }
      return result;
    }

    // Multipart body
    if (payload.parts) {
      this.extractBodyParts(payload.parts, result);
    }

    return result;
  },

  /**
   * Recursively extract body parts
   * @param {Array} parts - Message parts
   * @param {Object} result - Result object to populate
   */
  extractBodyParts(parts, result) {
    for (const part of parts) {
      const mimeType = part.mimeType;

      // Nested parts
      if (part.parts) {
        this.extractBodyParts(part.parts, result);
        continue;
      }

      // Skip attachments
      if (part.filename && part.filename.length > 0) {
        continue;
      }

      // Extract body data
      if (part.body?.data) {
        const decoded = this.decodeBase64(part.body.data);

        if (mimeType === 'text/plain' && !result.text) {
          result.text = decoded;
        } else if (mimeType === 'text/html' && !result.html) {
          result.html = decoded;
        }
      }
    }
  },

  /**
   * Parse attachments from payload
   * @param {Object} payload - Gmail message payload
   * @returns {Array} Attachments list
   */
  parseAttachments(payload) {
    const attachments = [];

    if (!payload?.parts) return attachments;

    this.extractAttachments(payload.parts, attachments);

    return attachments;
  },

  /**
   * Recursively extract attachments
   * @param {Array} parts - Message parts
   * @param {Array} result - Result array to populate
   */
  extractAttachments(parts, result) {
    for (const part of parts) {
      if (part.parts) {
        this.extractAttachments(part.parts, result);
        continue;
      }

      if (part.filename && part.filename.length > 0) {
        result.push({
          id: part.body?.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body?.size || 0,
        });
      }
    }
  },

  /**
   * Decode base64url string (Gmail format)
   * @param {string} data - Base64url encoded string
   * @returns {string} Decoded string
   */
  decodeBase64(data) {
    if (!data) return '';

    try {
      // Convert base64url to base64
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');

      // Decode
      return decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch (e) {
      console.error('Failed to decode base64:', e);
      return '';
    }
  },

  /**
   * Get initials from name or email
   * @param {Object} address - Parsed address
   * @returns {string} Initials (max 2 chars)
   */
  getInitials(address) {
    if (!address) return '?';

    const name = address.name || address.email || '';

    if (address.name) {
      const parts = address.name.split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return address.name.substring(0, 2).toUpperCase();
    }

    // Use email prefix
    const emailPrefix = address.email.split('@')[0];
    return emailPrefix.substring(0, 2).toUpperCase();
  },

  /**
   * Format date for display
   * @param {Date} date - Date object
   * @returns {string} Formatted date
   */
  formatDate(date) {
    if (!date || !(date instanceof Date)) return '';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Today: show time
    if (diff < dayMs && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // Yesterday
    const yesterday = new Date(now.getTime() - dayMs);
    if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
      return 'Hier';
    }

    // This year: show day and month
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    // Older: show full date
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  /**
   * Sanitize HTML content for safe display
   * @param {string} html - Raw HTML
   * @returns {string} Sanitized HTML
   */
  sanitizeHtml(html) {
    if (!html) return '';

    // Remove script tags
    let safe = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handlers
    safe = safe.replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');

    // Remove javascript: URLs
    safe = safe.replace(/href\s*=\s*["']?javascript:[^"'>]*/gi, 'href="#"');

    return safe;
  },

  /**
   * Convert plain text to HTML
   * @param {string} text - Plain text
   * @returns {string} HTML with links
   */
  textToHtml(text) {
    if (!text) return '';

    // Escape HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Convert URLs to links
    html = html.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    // Convert newlines to <br>
    html = html.replace(/\n/g, '<br>');

    return html;
  },
};

// Export for use in other scripts
window.EmailParser = EmailParser;
