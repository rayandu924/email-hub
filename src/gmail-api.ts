/**
 * Gmail API Helpers
 *
 * Proxies all Gmail requests through the MyWallpaper OAuth system.
 * Tokens are never exposed - all auth is handled by the host.
 */

import type { OAuthRequestOptions } from '@mywallpaper/sdk-react'
import { parseMessage, type GmailMessage, type ParsedEmail } from './email-parser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OAuthProxy {
  request: (
    provider: string,
    endpoint: string,
    options?: OAuthRequestOptions,
  ) => Promise<{ status: number; data: unknown }>
  isConnected: (provider: string) => Promise<boolean>
  getScopes: (provider: string) => Promise<string[]>
  requestScopes: (provider: string, scopes: string[]) => Promise<boolean>
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_PATH = '/gmail/v1/users/me'

export const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
]

const OPTIONAL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
]

// ---------------------------------------------------------------------------
// Low-level request helper
// ---------------------------------------------------------------------------

async function gmailRequest(
  oauth: OAuthProxy,
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const fullEndpoint = `${BASE_PATH}${endpoint}`

  const response = await oauth.request('google', fullEndpoint, {
    method: options.method || 'GET',
    body: options.body,
    requiredScopes: REQUIRED_SCOPES,
  })

  if (response.status >= 400) {
    throw new Error(`Gmail API error: ${response.status}`)
  }

  return response.data
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchEmailsOptions {
  query?: string
  maxResults?: number
  labelIds?: string[]
}

/**
 * Fetch emails: lists message IDs, then batch-fetches full message details.
 */
export async function fetchEmails(
  oauth: OAuthProxy,
  options: FetchEmailsOptions = {},
): Promise<ParsedEmail[]> {
  // Build query params
  const params = new URLSearchParams()
  if (options.maxResults) params.set('maxResults', String(options.maxResults))
  if (options.query) params.set('q', options.query)
  if (options.labelIds) {
    options.labelIds.forEach((id) => params.append('labelIds', id))
  }

  const qs = params.toString()
  const listEndpoint = `/messages${qs ? `?${qs}` : ''}`

  // 1. List message IDs
  const listData = (await gmailRequest(oauth, listEndpoint)) as GmailListResponse

  if (!listData.messages || listData.messages.length === 0) {
    return []
  }

  // 2. Batch-fetch individual messages in parallel
  const messageIds = listData.messages.map((m) => m.id)
  const messages = await Promise.all(
    messageIds.map((id) =>
      gmailRequest(oauth, `/messages/${id}?format=full`) as Promise<GmailMessage>,
    ),
  )

  // 3. Parse each message
  return messages.map(parseMessage)
}

/**
 * Mark a message as read by removing the UNREAD label.
 */
export async function markAsRead(oauth: OAuthProxy, messageId: string): Promise<void> {
  await gmailRequest(oauth, `/messages/${messageId}/modify`, {
    method: 'POST',
    body: { removeLabelIds: ['UNREAD'] },
  })
}

/**
 * Check if Gmail scopes are currently connected.
 */
export async function checkConnection(oauth: OAuthProxy): Promise<boolean> {
  try {
    const connected = await oauth.isConnected('google')
    if (!connected) return false

    const scopes = await oauth.getScopes('google')
    if (!scopes || scopes.length === 0) return false

    return scopes.some(
      (s) => s.includes('gmail.readonly') || s.includes('gmail.labels') || s.includes('gmail.modify'),
    )
  } catch {
    return false
  }
}

/**
 * Request the required Gmail scopes from the user.
 */
export async function requestPermission(oauth: OAuthProxy): Promise<boolean> {
  try {
    return await oauth.requestScopes('google', [...REQUIRED_SCOPES, ...OPTIONAL_SCOPES])
  } catch {
    return false
  }
}
