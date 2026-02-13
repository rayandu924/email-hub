/**
 * Email Hub - React Native Widget
 *
 * Displays Gmail emails in a MyWallpaper widget.
 * Uses a state machine: connect | loading | list | detail | error | empty
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useOAuth, useTheme, useSettings } from '@mywallpaper/sdk-react'
import {
  type ParsedEmail,
  sanitizeHtml,
  textToHtml,
  getInitials,
  formatDate,
} from './email-parser'
import {
  fetchEmails,
  markAsRead,
  checkConnection,
  requestPermission,
  type OAuthProxy,
  type FetchEmailsOptions,
} from './gmail-api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewState = 'connect' | 'loading' | 'list' | 'detail' | 'error' | 'empty'

interface EmailHubSettings {
  maxEmails: number
  refreshInterval: number
  showUnreadOnly: boolean
  labelFilter: string
  compactMode: boolean
  showAvatar: boolean
  showSnippet: boolean
}

// ---------------------------------------------------------------------------
// Styles (theme-aware)
// ---------------------------------------------------------------------------

function useStyles(mode: 'dark' | 'light') {
  return useMemo(() => {
    const isDark = mode === 'dark'

    const textPrimary = isDark ? '#f5f5f7' : '#1d1d1f'
    const textSecondary = isDark ? '#98989d' : '#86868b'
    const textTertiary = isDark ? '#636366' : '#aeaeb2'
    const surface = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
    const surfaceHover = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'
    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    const bg = isDark ? '#1c1c1e' : '#ffffff'
    const accent = '#007aff'
    const unreadDot = accent

    return {
      isDark,
      textPrimary,
      textSecondary,
      textTertiary,
      surface,
      surfaceHover,
      border,
      bg,
      accent,
      unreadDot,

      container: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        color: textPrimary,
        background: bg,
        borderRadius: 16,
        overflow: 'hidden',
        boxSizing: 'border-box' as const,
      },

      centerScreen: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        padding: 24,
        gap: 12,
        textAlign: 'center' as const,
      },

      header: {
        display: 'flex',
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        padding: '12px 16px',
        borderBottom: `1px solid ${border}`,
        flexShrink: 0,
      },

      headerTitle: {
        fontSize: 15,
        fontWeight: 600,
        color: textPrimary,
        margin: 0,
      },

      badge: {
        display: 'inline-flex',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        backgroundColor: accent,
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 600,
        marginLeft: 8,
      },

      iconBtn: {
        display: 'flex',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        width: 32,
        height: 32,
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        color: textSecondary,
        cursor: 'pointer',
        fontSize: 16,
      },

      list: {
        flex: 1,
        overflowY: 'auto' as const,
        overflowX: 'hidden' as const,
      },

      emailItem: (isUnread: boolean) => ({
        display: 'flex',
        alignItems: 'flex-start' as const,
        padding: '12px 16px',
        gap: 12,
        cursor: 'pointer',
        borderBottom: `1px solid ${border}`,
        background: 'transparent',
        transition: 'background 0.15s',
        fontWeight: isUnread ? 600 : 400,
      }),

      avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: surface,
        display: 'flex',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        fontSize: 13,
        fontWeight: 600,
        color: textSecondary,
        flexShrink: 0,
      },

      emailBody: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 2,
      },

      emailHeaderRow: {
        display: 'flex',
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
      },

      emailFrom: (isUnread: boolean) => ({
        fontSize: 14,
        fontWeight: isUnread ? 600 : 400,
        color: textPrimary,
        overflow: 'hidden' as const,
        textOverflow: 'ellipsis' as const,
        whiteSpace: 'nowrap' as const,
      }),

      emailDate: {
        fontSize: 12,
        color: textTertiary,
        flexShrink: 0,
        marginLeft: 8,
      },

      emailSubject: (isUnread: boolean) => ({
        fontSize: 13,
        fontWeight: isUnread ? 600 : 400,
        color: textPrimary,
        overflow: 'hidden' as const,
        textOverflow: 'ellipsis' as const,
        whiteSpace: 'nowrap' as const,
      }),

      emailSnippet: {
        fontSize: 12,
        color: textSecondary,
        overflow: 'hidden' as const,
        textOverflow: 'ellipsis' as const,
        whiteSpace: 'nowrap' as const,
        lineHeight: 1.4,
      },

      unreadIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: unreadDot,
        flexShrink: 0,
        marginTop: 6,
      },

      starLabel: {
        color: '#f5a623',
        fontSize: 12,
        marginTop: 2,
      },

      // Detail view
      detailContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden' as const,
      },

      detailHeader: {
        padding: '16px',
        borderBottom: `1px solid ${border}`,
        flexShrink: 0,
      },

      detailSubject: {
        fontSize: 17,
        fontWeight: 600,
        color: textPrimary,
        margin: '0 0 12px 0',
        lineHeight: 1.3,
      },

      detailMeta: {
        display: 'flex',
        alignItems: 'center' as const,
        gap: 10,
      },

      detailAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: surface,
        display: 'flex',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        fontSize: 15,
        fontWeight: 600,
        color: textSecondary,
        flexShrink: 0,
      },

      detailFrom: {
        fontSize: 14,
        fontWeight: 600,
        color: textPrimary,
      },

      detailTo: {
        fontSize: 12,
        color: textTertiary,
      },

      detailDate: {
        fontSize: 12,
        color: textTertiary,
        marginLeft: 'auto',
        flexShrink: 0,
      },

      detailBody: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: 16,
        fontSize: 14,
        lineHeight: 1.6,
        color: textPrimary,
        wordBreak: 'break-word' as const,
      },

      // Buttons
      primaryBtn: {
        display: 'inline-flex',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        padding: '10px 24px',
        borderRadius: 12,
        border: 'none',
        backgroundColor: accent,
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        gap: 8,
      },

      secondaryBtn: {
        display: 'inline-flex',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        padding: '8px 16px',
        borderRadius: 10,
        border: `1px solid ${border}`,
        backgroundColor: 'transparent',
        color: textSecondary,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
      },

      spinner: {
        width: 32,
        height: 32,
        border: `3px solid ${border}`,
        borderTopColor: accent,
        borderRadius: '50%',
        animation: 'email-hub-spin 0.8s linear infinite',
      },

      emptyIcon: {
        fontSize: 40,
        opacity: 0.3,
      },

      errorIcon: {
        fontSize: 40,
        opacity: 0.4,
        color: '#ff3b30',
      },

      messageText: {
        fontSize: 14,
        color: textSecondary,
        lineHeight: 1.5,
      },
    }
  }, [mode])
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner({ s }: { s: ReturnType<typeof useStyles> }) {
  return (
    <>
      <style>{`@keyframes email-hub-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={s.spinner} />
    </>
  )
}

function ConnectScreen({
  s,
  onConnect,
}: {
  s: ReturnType<typeof useStyles>
  onConnect: () => void
}) {
  return (
    <div style={s.centerScreen}>
      <div style={{ fontSize: 48, opacity: 0.3 }}>&#9993;</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: s.textPrimary }}>Email Hub</div>
      <div style={s.messageText}>Connectez votre compte Gmail pour afficher vos emails.</div>
      <button style={s.primaryBtn} onClick={onConnect}>
        Connecter Gmail
      </button>
    </div>
  )
}

function LoadingScreen({ s }: { s: ReturnType<typeof useStyles> }) {
  return (
    <div style={s.centerScreen}>
      <Spinner s={s} />
      <div style={s.messageText}>Chargement des emails...</div>
    </div>
  )
}

function EmptyScreen({
  s,
  onRefresh,
}: {
  s: ReturnType<typeof useStyles>
  onRefresh: () => void
}) {
  return (
    <div style={s.centerScreen}>
      <div style={s.emptyIcon}>&#128235;</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: s.textPrimary }}>
        Aucun email
      </div>
      <div style={s.messageText}>Votre boite de reception est vide.</div>
      <button style={s.secondaryBtn} onClick={onRefresh}>
        Actualiser
      </button>
    </div>
  )
}

function ErrorScreen({
  s,
  message,
  onRetry,
}: {
  s: ReturnType<typeof useStyles>
  message: string
  onRetry: () => void
}) {
  return (
    <div style={s.centerScreen}>
      <div style={s.errorIcon}>&#9888;</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: s.textPrimary }}>Erreur</div>
      <div style={s.messageText}>{message}</div>
      <button style={s.secondaryBtn} onClick={onRetry}>
        Reessayer
      </button>
    </div>
  )
}

function EmailListItem({
  email,
  s,
  showAvatar,
  showSnippet,
  onClick,
}: {
  email: ParsedEmail
  s: ReturnType<typeof useStyles>
  showAvatar: boolean
  showSnippet: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        ...s.emailItem(email.isUnread),
        background: hovered ? s.surfaceHover : 'transparent',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {email.isUnread && <div style={s.unreadIndicator} />}
      {showAvatar && (
        <div style={s.avatar}>{getInitials(email.from)}</div>
      )}
      <div style={s.emailBody}>
        <div style={s.emailHeaderRow}>
          <span style={s.emailFrom(email.isUnread)}>
            {email.from?.name || email.from?.email || 'Inconnu'}
          </span>
          <span style={s.emailDate}>{formatDate(email.date)}</span>
        </div>
        <div style={s.emailSubject(email.isUnread)}>{email.subject}</div>
        {showSnippet && <div style={s.emailSnippet}>{email.snippet}</div>}
        {email.isStarred && <span style={s.starLabel}>&#9733;</span>}
      </div>
    </div>
  )
}

function EmailList({
  emails,
  s,
  showAvatar,
  showSnippet,
  onSelect,
}: {
  emails: ParsedEmail[]
  s: ReturnType<typeof useStyles>
  showAvatar: boolean
  showSnippet: boolean
  onSelect: (email: ParsedEmail) => void
}) {
  return (
    <div style={s.list}>
      {emails.map((email) => (
        <EmailListItem
          key={email.id}
          email={email}
          s={s}
          showAvatar={showAvatar}
          showSnippet={showSnippet}
          onClick={() => onSelect(email)}
        />
      ))}
    </div>
  )
}

function EmailDetail({
  email,
  s,
  onBack,
}: {
  email: ParsedEmail
  s: ReturnType<typeof useStyles>
  onBack: () => void
}) {
  const bodyHtml = useMemo(() => {
    if (email.bodyHtml) {
      return sanitizeHtml(email.bodyHtml)
    }
    if (email.bodyText) {
      return textToHtml(email.bodyText)
    }
    return '<em>Aucun contenu</em>'
  }, [email.bodyHtml, email.bodyText])

  return (
    <div style={s.detailContainer}>
      <div style={s.header}>
        <button style={s.iconBtn} onClick={onBack} title="Retour">
          &#8592;
        </button>
        <span style={{ fontSize: 13, color: s.textSecondary }}>Detail</span>
        <div style={{ width: 32 }} />
      </div>
      <div style={s.detailHeader}>
        <h2 style={s.detailSubject}>{email.subject}</h2>
        <div style={s.detailMeta}>
          <div style={s.detailAvatar}>{getInitials(email.from)}</div>
          <div>
            <div style={s.detailFrom}>
              {email.from?.name || email.from?.email || 'Inconnu'}
            </div>
            <div style={s.detailTo}>a moi</div>
          </div>
          <div style={s.detailDate}>
            {email.date?.toLocaleString('fr-FR')}
          </div>
        </div>
      </div>
      <div
        style={s.detailBody}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EmailHub() {
  const oauth = useOAuth() as OAuthProxy
  const { mode } = useTheme()
  const settings = useSettings<EmailHubSettings>()
  const s = useStyles(mode)

  // State machine
  const [view, setView] = useState<ViewState>('loading')
  const [emails, setEmails] = useState<ParsedEmail[]>([])
  const [selectedEmail, setSelectedEmail] = useState<ParsedEmail | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Derived
  const unreadCount = useMemo(
    () => emails.filter((e) => e.isUnread).length,
    [emails],
  )

  // -----------------------------------
  // Fetch emails
  // -----------------------------------
  const loadEmails = useCallback(async () => {
    setIsRefreshing(true)

    try {
      const opts: FetchEmailsOptions = {
        maxResults: settings.maxEmails || 10,
      }

      // Label filter
      if (settings.labelFilter && settings.labelFilter !== 'ALL') {
        opts.labelIds = [settings.labelFilter]
      }

      // Unread filter
      if (settings.showUnreadOnly) {
        opts.query = 'is:unread'
      }

      const result = await fetchEmails(oauth, opts)

      if (result.length === 0) {
        setEmails([])
        setView('empty')
      } else {
        setEmails(result)
        setView('list')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''

      if (msg.includes('not connected') || msg.includes('403')) {
        setView('connect')
        return
      }

      if (msg.includes('insufficient_scopes')) {
        setErrorMessage('Permissions Gmail insuffisantes. Reconnectez-vous.')
      } else {
        setErrorMessage('Impossible de charger les emails')
      }
      setView('error')
    } finally {
      setIsRefreshing(false)
    }
  }, [oauth, settings.maxEmails, settings.labelFilter, settings.showUnreadOnly])

  // -----------------------------------
  // Connection check on mount
  // -----------------------------------
  useEffect(() => {
    let cancelled = false

    async function init() {
      setView('loading')

      const connected = await checkConnection(oauth)
      if (cancelled) return

      if (connected) {
        await loadEmails()
      } else {
        setView('connect')
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------
  // Auto-refresh timer
  // -----------------------------------
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    const intervalMs = (settings.refreshInterval || 5) * 60 * 1000

    refreshTimerRef.current = setInterval(() => {
      // Only refresh when on the list view
      if (!selectedEmail) {
        loadEmails()
      }
    }, intervalMs)

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [settings.refreshInterval, selectedEmail, loadEmails])

  // -----------------------------------
  // Reload when filter settings change
  // -----------------------------------
  const prevFilterRef = useRef({
    label: settings.labelFilter,
    unread: settings.showUnreadOnly,
    max: settings.maxEmails,
  })

  useEffect(() => {
    const prev = prevFilterRef.current
    const changed =
      prev.label !== settings.labelFilter ||
      prev.unread !== settings.showUnreadOnly ||
      prev.max !== settings.maxEmails

    prevFilterRef.current = {
      label: settings.labelFilter,
      unread: settings.showUnreadOnly,
      max: settings.maxEmails,
    }

    if (changed && (view === 'list' || view === 'empty')) {
      loadEmails()
    }
  }, [settings.labelFilter, settings.showUnreadOnly, settings.maxEmails]) // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------
  // Handlers
  // -----------------------------------
  const handleConnect = useCallback(async () => {
    setView('loading')

    const granted = await requestPermission(oauth)

    if (granted) {
      await loadEmails()
    } else {
      setView('connect')
    }
  }, [oauth, loadEmails])

  const handleSelectEmail = useCallback(
    async (email: ParsedEmail) => {
      setSelectedEmail(email)
      setView('detail')

      // Mark as read
      if (email.isUnread) {
        try {
          await markAsRead(oauth, email.id)
          setEmails((prev) =>
            prev.map((e) =>
              e.id === email.id ? { ...e, isUnread: false } : e,
            ),
          )
        } catch {
          // Silently fail - not critical
        }
      }
    },
    [oauth],
  )

  const handleBack = useCallback(() => {
    setSelectedEmail(null)
    setView('list')
  }, [])

  const handleRefresh = useCallback(() => {
    loadEmails()
  }, [loadEmails])

  const handleRetry = useCallback(() => {
    loadEmails()
  }, [loadEmails])

  // -----------------------------------
  // Render
  // -----------------------------------
  return (
    <div style={s.container}>
      {/* Header - shown on list view */}
      {view === 'list' && (
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={s.headerTitle}>Emails</h1>
            {unreadCount > 0 && (
              <span style={s.badge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <button
            style={{
              ...s.iconBtn,
              opacity: isRefreshing ? 0.5 : 1,
            }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Actualiser"
          >
            &#8635;
          </button>
        </div>
      )}

      {/* Views */}
      {view === 'connect' && (
        <ConnectScreen s={s} onConnect={handleConnect} />
      )}

      {view === 'loading' && <LoadingScreen s={s} />}

      {view === 'empty' && <EmptyScreen s={s} onRefresh={handleRefresh} />}

      {view === 'error' && (
        <ErrorScreen s={s} message={errorMessage} onRetry={handleRetry} />
      )}

      {view === 'list' && (
        <EmailList
          emails={emails}
          s={s}
          showAvatar={settings.showAvatar ?? true}
          showSnippet={settings.showSnippet ?? true}
          onSelect={handleSelectEmail}
        />
      )}

      {view === 'detail' && selectedEmail && (
        <EmailDetail email={selectedEmail} s={s} onBack={handleBack} />
      )}
    </div>
  )
}
