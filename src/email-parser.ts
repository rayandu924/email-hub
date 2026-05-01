/**
 * Email Parser - Parse Gmail API message format
 *
 * Gmail returns emails in a specific format with headers and body parts.
 * This module handles parsing and decoding MIME messages.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedAddress {
  name: string
  email: string
  raw?: string
}

export interface ParsedAttachment {
  id: string | undefined
  filename: string
  mimeType: string
  size: number
}

export interface ParsedEmail {
  id: string
  threadId: string
  snippet: string
  internalDate: number
  date: Date

  from: ParsedAddress
  to: ParsedAddress[]
  cc: ParsedAddress[]
  subject: string
  replyTo: string | undefined

  bodyText: string
  bodyHtml: string

  labels: string[]
  isUnread: boolean
  isStarred: boolean
  isImportant: boolean
  isInbox: boolean
  isDraft: boolean
  isSent: boolean
  isTrash: boolean
  isSpam: boolean

  attachments: ParsedAttachment[]
}

interface GmailHeader {
  name: string
  value: string
}

interface GmailPayloadBody {
  attachmentId?: string
  size?: number
  data?: string
}

interface GmailPayloadPart {
  mimeType: string
  filename?: string
  headers?: GmailHeader[]
  body?: GmailPayloadBody
  parts?: GmailPayloadPart[]
}

interface GmailPayload {
  mimeType: string
  headers?: GmailHeader[]
  body?: GmailPayloadBody
  parts?: GmailPayloadPart[]
}

export interface GmailMessage {
  id: string
  threadId: string
  snippet?: string
  internalDate: string
  labelIds?: string[]
  payload?: GmailPayload
}

// ---------------------------------------------------------------------------
// Base64url decoder
// ---------------------------------------------------------------------------

export function decodeBase64Url(data: string): string {
  if (!data) return ''

  try {
    // Convert base64url to standard base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/')

    // Decode
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
  } catch {
    console.error('[EmailParser] Failed to decode base64url')
    return ''
  }
}

// ---------------------------------------------------------------------------
// MIME part extraction
// ---------------------------------------------------------------------------

interface BodyResult {
  text: string
  html: string
}

export function extractParts(parts: GmailPayloadPart[], result: BodyResult): void {
  for (const part of parts) {
    // Recurse into nested multipart
    if (part.parts) {
      extractParts(part.parts, result)
      continue
    }

    // Skip attachments
    if (part.filename && part.filename.length > 0) {
      continue
    }

    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data)

      if (part.mimeType === 'text/plain' && !result.text) {
        result.text = decoded
      } else if (part.mimeType === 'text/html' && !result.html) {
        result.html = decoded
      }
    }
  }
}

export function getBody(payload: GmailPayload | undefined): BodyResult {
  const result: BodyResult = { text: '', html: '' }
  if (!payload) return result

  // Simple body (no parts)
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data)
    if (payload.mimeType === 'text/html') {
      result.html = decoded
    } else {
      result.text = decoded
    }
    return result
  }

  // Multipart body
  if (payload.parts) {
    extractParts(payload.parts, result)
  }

  return result
}

// ---------------------------------------------------------------------------
// HTML sanitizer
// ---------------------------------------------------------------------------

export function sanitizeHtml(html: string): string {
  if (!html) return ''

  // Remove script tags
  let safe = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove event handlers
  safe = safe.replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')

  // Remove javascript: URLs
  safe = safe.replace(/href\s*=\s*["']?javascript:[^"'>]*/gi, 'href="#"')

  return safe
}

// ---------------------------------------------------------------------------
// Plain text to HTML
// ---------------------------------------------------------------------------

export function textToHtml(text: string): string {
  if (!text) return ''

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  // Convert URLs to links
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>',
  )

  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>')

  return html
}

// ---------------------------------------------------------------------------
// Address parsing
// ---------------------------------------------------------------------------

export function parseEmailAddress(addressStr: string): ParsedAddress {
  if (!addressStr) return { name: '', email: '' }

  const match = addressStr.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/)

  if (match) {
    return {
      name: (match[1] || '').trim(),
      email: (match[2] || '').trim(),
      raw: addressStr,
    }
  }

  return { name: '', email: addressStr.trim(), raw: addressStr }
}

function parseAddressList(addressesStr: string | undefined): ParsedAddress[] {
  if (!addressesStr) return []

  const addresses = addressesStr.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
  return addresses.map((addr) => parseEmailAddress(addr.trim())).filter((a) => a.email)
}

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

function parseHeaders(headers: GmailHeader[]): Record<string, string> {
  const result: Record<string, string> = {}
  const keep = ['from', 'to', 'cc', 'bcc', 'subject', 'date', 'reply-to', 'message-id']

  for (const header of headers) {
    const name = header.name.toLowerCase()
    if (keep.includes(name)) {
      result[name] = header.value
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Attachment extraction
// ---------------------------------------------------------------------------

function extractAttachments(parts: GmailPayloadPart[], result: ParsedAttachment[]): void {
  for (const part of parts) {
    if (part.parts) {
      extractAttachments(part.parts, result)
      continue
    }
    if (part.filename && part.filename.length > 0) {
      result.push({
        id: part.body?.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body?.size || 0,
      })
    }
  }
}

function parseAttachments(payload: GmailPayload | undefined): ParsedAttachment[] {
  const attachments: ParsedAttachment[] = []
  if (!payload?.parts) return attachments
  extractAttachments(payload.parts, attachments)
  return attachments
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function getInitials(address: ParsedAddress | undefined): string {
  if (!address) return '?'

  if (address.name) {
    const parts = address.name.split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return address.name.substring(0, 2).toUpperCase()
  }

  if (address.email) {
    const prefix = address.email.split('@')[0]
    return prefix.substring(0, 2).toUpperCase()
  }

  return '?'
}

export function formatDate(date: Date | undefined): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return ''

  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  // Today: show time
  if (diff < dayMs && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  // Yesterday
  const yesterday = new Date(now.getTime() - dayMs)
  if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
    return 'Hier'
  }

  // This year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // Older
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Full message parser
// ---------------------------------------------------------------------------

export function parseMessage(message: GmailMessage): ParsedEmail {
  const headers = parseHeaders(message.payload?.headers || [])
  const body = getBody(message.payload)
  const labels = message.labelIds || []

  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet || '',
    internalDate: parseInt(message.internalDate, 10),
    date: new Date(parseInt(message.internalDate, 10)),

    from: parseEmailAddress(headers.from),
    to: parseAddressList(headers.to),
    cc: parseAddressList(headers.cc),
    subject: headers.subject || '(Sans objet)',
    replyTo: headers['reply-to'],

    bodyText: body.text,
    bodyHtml: body.html,

    labels,
    isUnread: labels.includes('UNREAD'),
    isStarred: labels.includes('STARRED'),
    isImportant: labels.includes('IMPORTANT'),
    isInbox: labels.includes('INBOX'),
    isDraft: labels.includes('DRAFT'),
    isSent: labels.includes('SENT'),
    isTrash: labels.includes('TRASH'),
    isSpam: labels.includes('SPAM'),

    attachments: parseAttachments(message.payload),
  }
}
