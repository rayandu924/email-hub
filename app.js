/**
 * Email Hub - Main Application
 *
 * MyWallPaper Addon for displaying Gmail emails
 */

(function() {
  'use strict';

  // ============================================================================
  // State
  // ============================================================================

  const state = {
    // Settings from manifest
    settings: {
      maxEmails: 10,
      refreshInterval: 5,
      showUnreadOnly: false,
      labelFilter: 'INBOX',
      theme: 'auto',
      cardColor: '#ffffff',
      cardOpacity: 100,
      cardBorderRadius: 20,
      accentColor: '#007aff',
      cardBlur: 0,
      compactMode: false,
      showAvatar: true,
      showSnippet: true,
      showShadow: true,
    },

    // Runtime state
    emails: [],
    selectedEmail: null,
    unreadCount: 0,
    isLoading: false,
    isConnected: false,
    error: null,
    refreshTimer: null,
  };

  // ============================================================================
  // DOM Elements
  // ============================================================================

  const elements = {
    app: null,
    connectState: null,
    loadingState: null,
    errorState: null,
    emptyState: null,
    emailList: null,
    emailDetail: null,
    emailContent: null,
    unreadBadge: null,
    refreshBtn: null,
    connectBtn: null,
    retryBtn: null,
    backBtn: null,
    errorMessage: null,
  };

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    // Get DOM elements
    elements.app = document.getElementById('app');
    elements.connectState = document.getElementById('connect-state');
    elements.loadingState = document.getElementById('loading-state');
    elements.errorState = document.getElementById('error-state');
    elements.emptyState = document.getElementById('empty-state');
    elements.emailList = document.getElementById('email-list');
    elements.emailDetail = document.getElementById('email-detail');
    elements.emailContent = document.getElementById('email-content');
    elements.unreadBadge = document.getElementById('unread-badge');
    elements.refreshBtn = document.getElementById('refresh-btn');
    elements.connectBtn = document.getElementById('connect-btn');
    elements.retryBtn = document.getElementById('retry-btn');
    elements.backBtn = document.getElementById('back-btn');
    elements.errorMessage = document.getElementById('error-message');

    // Bind events
    elements.refreshBtn.addEventListener('click', handleRefresh);
    elements.connectBtn.addEventListener('click', handleConnect);
    elements.retryBtn.addEventListener('click', handleRetry);
    elements.backBtn.addEventListener('click', handleBack);

    // Wait for MyWallPaper API
    if (window.MyWallpaper) {
      initWithApi(window.MyWallpaper);
    } else {
      // Fallback: wait for API to be available
      window.addEventListener('message', function onMessage(event) {
        if (event.data?.type === 'INIT' && window.MyWallpaper) {
          window.removeEventListener('message', onMessage);
          initWithApi(window.MyWallpaper);
        }
      });
    }
  }

  function initWithApi(api) {
    // Initialize Gmail API
    GmailAPI.init(api);

    // Get initial settings
    if (api.config) {
      updateSettings(api.config);
    }

    // Listen for settings changes (hot-reload)
    api.onSettingsChange((newSettings, changedKeys) => {
      updateSettings(newSettings);

      // If display settings changed, re-render
      if (changedKeys?.some(k => ['compactMode', 'showAvatar', 'showSnippet', 'theme'].includes(k))) {
        applyTheme();
        renderEmailList();
      }

      // If card style settings changed, apply them
      if (changedKeys?.some(k => ['cardColor', 'cardOpacity', 'cardBorderRadius', 'accentColor', 'cardBlur', 'showShadow'].includes(k))) {
        applyCardStyles();
      }

      // If filter settings changed, reload
      if (changedKeys?.some(k => ['labelFilter', 'showUnreadOnly', 'maxEmails'].includes(k))) {
        loadEmails();
      }

      // If refresh interval changed, restart timer
      if (changedKeys?.includes('refreshInterval')) {
        setupRefreshTimer();
      }
    });

    // Listen for theme changes
    api.onEvent('theme:change', (data) => {
      if (state.settings.theme === 'auto') {
        applyTheme(data.theme);
      }
    });

    // Listen for visibility changes
    api.onEvent('visibility:change', (data) => {
      if (data.visible && state.isConnected) {
        loadEmails();
      }
    });

    // Signal ready
    api.ready({
      capabilities: ['hot-reload', 'system-events'],
      subscribedEvents: ['theme:change', 'visibility:change'],
    });

    // Apply theme
    applyTheme();

    // Check connection and load
    checkConnectionAndLoad();
  }

  // ============================================================================
  // Settings & Theme
  // ============================================================================

  function updateSettings(newSettings) {
    Object.assign(state.settings, newSettings);
  }

  function applyTheme(systemTheme) {
    const theme = state.settings.theme;

    if (theme === 'auto') {
      // Use system theme if provided, otherwise detect
      const prefersDark = systemTheme === 'dark' ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }

    // Apply display modes
    elements.emailList.classList.toggle('compact', state.settings.compactMode);
    elements.emailList.classList.toggle('no-avatar', !state.settings.showAvatar);
    elements.emailList.classList.toggle('no-snippet', !state.settings.showSnippet);

    // Apply card styles too
    applyCardStyles();
  }

  function applyCardStyles() {
    const { cardColor, cardOpacity, cardBorderRadius, accentColor, cardBlur, showShadow } = state.settings;
    const root = document.documentElement;
    const card = document.querySelector('.card-container');

    // Parse color and apply opacity
    const opacity = cardOpacity / 100;
    let bgColor = cardColor;

    // Convert hex to rgba if needed
    if (cardColor.startsWith('#')) {
      const r = parseInt(cardColor.slice(1, 3), 16);
      const g = parseInt(cardColor.slice(3, 5), 16);
      const b = parseInt(cardColor.slice(5, 7), 16);
      bgColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Apply CSS variables
    root.style.setProperty('--card-bg-custom', bgColor);
    root.style.setProperty('--card-radius-custom', `${cardBorderRadius}px`);
    root.style.setProperty('--accent-custom', accentColor);
    root.style.setProperty('--card-blur', `${cardBlur}px`);

    // Apply to card element
    if (card) {
      card.style.background = bgColor;
      card.style.borderRadius = `${cardBorderRadius}px`;
      card.style.backdropFilter = cardBlur > 0 ? `blur(${cardBlur}px)` : 'none';
      card.style.webkitBackdropFilter = cardBlur > 0 ? `blur(${cardBlur}px)` : 'none';
      card.style.boxShadow = showShadow ? 'var(--shadow-card)' : 'none';
    }

    // Apply accent color
    root.style.setProperty('--accent', accentColor);

    // Update text colors for contrast if card is dark
    if (cardColor.startsWith('#')) {
      const r = parseInt(cardColor.slice(1, 3), 16);
      const g = parseInt(cardColor.slice(3, 5), 16);
      const b = parseInt(cardColor.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      if (luminance < 0.5 && opacity > 0.5) {
        // Dark background - use light text
        root.style.setProperty('--text-primary', '#f5f5f7');
        root.style.setProperty('--text-secondary', '#98989d');
        root.style.setProperty('--text-tertiary', '#636366');
        root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
        root.style.setProperty('--surface-hover', 'rgba(255, 255, 255, 0.08)');
      } else {
        // Light background - use dark text
        root.style.setProperty('--text-primary', '#1d1d1f');
        root.style.setProperty('--text-secondary', '#86868b');
        root.style.setProperty('--text-tertiary', '#aeaeb2');
        root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.06)');
        root.style.setProperty('--surface-hover', 'rgba(0, 0, 0, 0.04)');
      }
    }
  }

  // ============================================================================
  // Connection & Loading
  // ============================================================================

  async function checkConnectionAndLoad() {
    showState('loading');

    try {
      state.isConnected = await GmailAPI.isConnected();

      if (state.isConnected) {
        await loadEmails();
        setupRefreshTimer();
      } else {
        showState('connect');
      }
    } catch (error) {
      console.error('[EmailHub] Connection check failed:', error);
      showState('connect');
    }
  }

  async function handleConnect() {
    console.log('[EmailHub] Connect button clicked');
    showState('loading');

    try {
      console.log('[EmailHub] Requesting Google permission...');
      const granted = await GmailAPI.requestPermission();
      console.log('[EmailHub] Permission granted:', granted);

      if (granted) {
        state.isConnected = true;
        await loadEmails();
        setupRefreshTimer();
      } else {
        console.log('[EmailHub] Permission not granted, showing connect state');
        showState('connect');
      }
    } catch (error) {
      console.error('[EmailHub] Connect failed:', error);
      showError('Impossible de se connecter à Gmail');
    }
  }

  async function loadEmails() {
    if (state.isLoading) return;

    state.isLoading = true;
    elements.refreshBtn.classList.add('loading');

    try {
      // Build query
      const options = {
        maxResults: state.settings.maxEmails,
      };

      // Label filter
      if (state.settings.labelFilter && state.settings.labelFilter !== 'ALL') {
        options.labelIds = [state.settings.labelFilter];
      }

      // Unread filter
      if (state.settings.showUnreadOnly) {
        options.q = 'is:unread';
      }

      // Get message list
      const listResponse = await GmailAPI.listMessages(options);

      if (!listResponse.messages || listResponse.messages.length === 0) {
        state.emails = [];
        state.unreadCount = 0;
        showState('empty');
        return;
      }

      // Get full message details
      const messageIds = listResponse.messages.map(m => m.id);
      const messages = await GmailAPI.getMessages(messageIds, 'full');

      // Parse emails
      state.emails = messages.map(msg => EmailParser.parse(msg));

      // Count unread
      state.unreadCount = state.emails.filter(e => e.isUnread).length;
      updateUnreadBadge();

      // Render
      renderEmailList();
      showState('list');

    } catch (error) {
      console.error('[EmailHub] Load failed:', error);

      const errorMsg = error.message?.toLowerCase() || '';

      // Check if Google is not connected
      if (errorMsg.includes('not connected') || errorMsg.includes('403')) {
        console.log('[EmailHub] Google not connected, showing connect state');
        state.isConnected = false;
        showState('connect');
        return;
      }

      // Check if it's a scope error
      if (errorMsg.includes('insufficient_scopes')) {
        showError('Permissions Gmail insuffisantes. Reconnectez-vous.');
        state.isConnected = false;
      } else {
        showError('Impossible de charger les emails');
      }
    } finally {
      state.isLoading = false;
      elements.refreshBtn.classList.remove('loading');
    }
  }

  function setupRefreshTimer() {
    // Clear existing timer
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
    }

    // Set new timer
    const intervalMs = state.settings.refreshInterval * 60 * 1000;
    state.refreshTimer = setInterval(() => {
      if (state.isConnected && !state.selectedEmail) {
        loadEmails();
      }
    }, intervalMs);
  }

  // ============================================================================
  // UI State Management
  // ============================================================================

  function showState(stateName) {
    // Hide all states
    elements.connectState.classList.add('hidden');
    elements.loadingState.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    elements.emailList.classList.add('hidden');
    elements.emailDetail.classList.add('hidden');

    // Show requested state
    switch (stateName) {
      case 'connect':
        elements.connectState.classList.remove('hidden');
        break;
      case 'loading':
        elements.loadingState.classList.remove('hidden');
        break;
      case 'error':
        elements.errorState.classList.remove('hidden');
        break;
      case 'empty':
        elements.emptyState.classList.remove('hidden');
        break;
      case 'list':
        elements.emailList.classList.remove('hidden');
        break;
      case 'detail':
        elements.emailDetail.classList.remove('hidden');
        break;
    }
  }

  function showError(message) {
    state.error = message;
    elements.errorMessage.textContent = message;
    showState('error');
  }

  function updateUnreadBadge() {
    if (state.unreadCount > 0) {
      elements.unreadBadge.textContent = state.unreadCount > 99 ? '99+' : state.unreadCount;
      elements.unreadBadge.classList.remove('hidden');
    } else {
      elements.unreadBadge.classList.add('hidden');
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  function renderEmailList() {
    elements.emailList.innerHTML = state.emails.map(email => `
      <div class="email-item ${email.isUnread ? 'unread' : ''}" data-id="${email.id}">
        ${state.settings.showAvatar ? `
          <div class="email-avatar">${EmailParser.getInitials(email.from)}</div>
        ` : ''}
        <div class="email-body">
          <div class="email-header">
            <span class="email-from">${escapeHtml(email.from?.name || email.from?.email || 'Inconnu')}</span>
            <span class="email-date">${EmailParser.formatDate(email.date)}</span>
          </div>
          <div class="email-subject">${escapeHtml(email.subject)}</div>
          ${state.settings.showSnippet ? `
            <div class="email-snippet">${escapeHtml(email.snippet)}</div>
          ` : ''}
          ${renderLabels(email)}
        </div>
      </div>
    `).join('');

    // Bind click events
    elements.emailList.querySelectorAll('.email-item').forEach(item => {
      item.addEventListener('click', () => {
        const emailId = item.dataset.id;
        const email = state.emails.find(e => e.id === emailId);
        if (email) showEmailDetail(email);
      });
    });
  }

  function renderLabels(email) {
    const labels = [];

    if (email.isStarred) {
      labels.push('<span class="email-star">★</span>');
    }

    if (email.isImportant && !email.isInbox) {
      labels.push('<span class="email-label">Important</span>');
    }

    if (labels.length === 0) return '';

    return `<div class="email-meta">${labels.join('')}</div>`;
  }

  function showEmailDetail(email) {
    state.selectedEmail = email;

    // Get body content
    let bodyHtml = '';
    if (email.bodyHtml) {
      bodyHtml = EmailParser.sanitizeHtml(email.bodyHtml);
    } else if (email.bodyText) {
      bodyHtml = EmailParser.textToHtml(email.bodyText);
    }

    elements.emailContent.innerHTML = `
      <div class="detail-header">
        <h2 class="detail-subject">${escapeHtml(email.subject)}</h2>
        <div class="detail-meta">
          <div class="detail-avatar">${EmailParser.getInitials(email.from)}</div>
          <div class="detail-info">
            <div class="detail-from">${escapeHtml(email.from?.name || email.from?.email || 'Inconnu')}</div>
            <div class="detail-to">à moi</div>
          </div>
          <div class="detail-date">${email.date.toLocaleString('fr-FR')}</div>
        </div>
      </div>
      <div class="detail-body">${bodyHtml}</div>
    `;

    showState('detail');

    // Mark as read if unread
    if (email.isUnread) {
      markEmailAsRead(email);
    }
  }

  async function markEmailAsRead(email) {
    try {
      await GmailAPI.markAsRead(email.id);

      // Update local state
      email.isUnread = false;
      state.unreadCount = Math.max(0, state.unreadCount - 1);
      updateUnreadBadge();

      // Update list item
      const item = elements.emailList.querySelector(`[data-id="${email.id}"]`);
      if (item) item.classList.remove('unread');

    } catch (error) {
      console.error('[EmailHub] Failed to mark as read:', error);
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  function handleRefresh() {
    if (state.isConnected) {
      loadEmails();
    } else {
      handleConnect();
    }
  }

  function handleRetry() {
    if (state.isConnected) {
      loadEmails();
    } else {
      checkConnectionAndLoad();
    }
  }

  function handleBack() {
    state.selectedEmail = null;
    showState('list');
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================================
  // Start
  // ============================================================================

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
