# Audit Complet - Email Hub Addon pour MyWallPaper

**Date** : 2026-02-01
**Projet parent** : MyWallPaper
**Objectif** : Centraliser les emails (Gmail, puis multi-provider) en un seul widget addon

---

## 1. Infrastructure existante

### 1.1 SDK Addon v2.0

L'architecture existante est **très favorable** pour cet addon :

| Élément | État | Détail |
|---------|------|--------|
| OAuth Google | Déjà présent | `oauth-service.ts` supporte Google |
| OAuth Proxy | Sécurisé | Tokens côté backend, jamais exposés |
| Permission `oauth:google` | Définie | Dans les types du SDK |
| API `oauth.request()` | Disponible | Pour appeler les APIs Google |
| Hot-reload | Supporté | Settings sans rechargement |
| Storage API | Disponible | Pour cache local |

### 1.2 Types et Permissions (SDK)

```typescript
// OAuth Providers supportés
type OAuthProviderType = 'github' | 'google' | 'discord' | 'spotify' | 'twitch'

// Permissions disponibles
type PermissionType =
  | 'storage'
  | 'cpu-high'
  | 'network'
  | 'audio'
  | 'notifications'
  | 'oauth:github'
  | 'oauth:google'    // <-- Celui qu'on utilise
  | 'oauth:discord'
  | 'oauth:spotify'
  | 'oauth:twitch'
```

### 1.3 API OAuth disponible pour les addons

```typescript
interface MyWallpaperAPI {
  oauth: {
    // Faire une requête API via le proxy sécurisé
    request(
      provider: OAuthProvider,
      endpoint: string,
      options?: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
        body?: unknown
        headers?: Record<string, string>
        requiredScopes?: string[]
      }
    ): Promise<OAuthResponse | OAuthScopesError>

    // Vérifier si connecté
    isConnected(provider: OAuthProvider): Promise<boolean>

    // Obtenir les scopes actuels
    getScopes(provider: OAuthProvider): Promise<string[]>

    // Demander des scopes supplémentaires
    requestScopes(provider: OAuthProvider, scopes: string[], reason: string): Promise<boolean>
  }
}
```

---

## 2. Modifications nécessaires

### 2.1 Scopes Gmail à ajouter

Actuellement, l'OAuth Google n'a que `openid email profile`. Pour Gmail :

```typescript
// Scopes Gmail nécessaires
const GMAIL_SCOPES = {
  // Minimal (lecture seule)
  readonly: [
    'https://www.googleapis.com/auth/gmail.readonly',  // Lire emails
    'https://www.googleapis.com/auth/gmail.labels'      // Lire labels
  ],

  // Standard (lecture + actions)
  standard: [
    'https://www.googleapis.com/auth/gmail.modify',     // Lire/modifier
    'https://www.googleapis.com/auth/gmail.labels'
  ],

  // Complet (envoi inclus)
  full: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',       // Envoyer emails
    'https://www.googleapis.com/auth/gmail.compose'     // Composer
  ]
}
```

### 2.2 Configuration Google Cloud Console requise

1. **API Gmail activée** dans Google Cloud Console
2. **Scopes ajoutés** à l'application OAuth
3. **Vérification app** (si scopes sensibles) - peut nécessiter une review Google

### 2.3 Modifications backend nécessaires

Le proxy OAuth doit supporter les endpoints Gmail :

```typescript
// Endpoints Gmail à whitelist
const GMAIL_ENDPOINTS = [
  'https://gmail.googleapis.com/gmail/v1/users/me/messages',
  'https://gmail.googleapis.com/gmail/v1/users/me/labels',
  'https://gmail.googleapis.com/gmail/v1/users/me/threads',
  'https://gmail.googleapis.com/gmail/v1/users/me/profile'
]
```

---

## 3. Fonctionnalités par phase

### Phase 1 - Lecture seule (Facile)

| Fonctionnalité | Complexité | API Gmail |
|----------------|------------|-----------|
| Liste des emails récents | Faible | `messages.list` |
| Afficher un email | Faible | `messages.get` |
| Compteur non-lus | Faible | `messages.list?q=is:unread` |
| Liste des labels | Faible | `labels.list` |
| Filtrer par label | Faible | `messages.list?labelIds=` |
| Profil utilisateur | Faible | `users.getProfile` |

### Phase 2 - Actions (Moyenne)

| Fonctionnalité | Complexité | API Gmail |
|----------------|------------|-----------|
| Marquer comme lu/non-lu | Moyenne | `messages.modify` |
| Archiver | Moyenne | `messages.modify` (remove INBOX) |
| Supprimer | Moyenne | `messages.trash` |
| Ajouter/retirer label | Moyenne | `messages.modify` |
| Étoiler | Moyenne | `messages.modify` (add STARRED) |

### Phase 3 - Avancé (Complexe)

| Fonctionnalité | Complexité | Notes |
|----------------|------------|-------|
| Envoyer email | Haute | Nécessite scope `gmail.send` + UI compose |
| Répondre | Haute | Threading complexe |
| Pièces jointes | Haute | Gestion multipart |
| Push notifications | Haute | Nécessite Pub/Sub Google |

---

## 4. Structure de l'addon

```
email-hub/
├── CLAUDE.md               # Instructions pour Claude Code
├── docs/
│   ├── AUDIT.md            # Ce fichier
│   └── GOOGLE_CLOUD_SETUP.md  # Guide configuration Google
├── src/
│   ├── manifest.json       # Configuration addon
│   ├── index.html          # Point d'entrée
│   ├── styles.css          # Styles
│   ├── app.js              # Logique principale
│   └── lib/
│       ├── gmail-api.js    # Wrapper API Gmail
│       └── email-parser.js # Parser MIME emails
└── preview.png             # Preview pour le store
```

### Manifest.json prévu

```json
{
  "name": "Email Hub",
  "version": "1.0.0",
  "description": "Centralisez vos emails Gmail sur votre bureau",
  "author": "rayandu924",
  "type": "widget",
  "categories": ["productivity", "communication"],

  "oauth": {
    "required": [{
      "provider": "google",
      "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
      "reason": "Afficher vos emails récents"
    }],
    "optional": [{
      "provider": "google",
      "scopes": ["https://www.googleapis.com/auth/gmail.modify"],
      "reason": "Permettre les actions (archiver, marquer lu)"
    }]
  },

  "capabilities": {
    "hotReload": true,
    "systemEvents": ["theme:change", "visibility:change"]
  },

  "settings": {
    "display": { "type": "section", "label": "Affichage" },
    "maxEmails": {
      "type": "range",
      "label": "Nombre d'emails",
      "min": 5,
      "max": 50,
      "default": 10
    },
    "refreshInterval": {
      "type": "range",
      "label": "Actualisation (minutes)",
      "min": 1,
      "max": 60,
      "default": 5
    },
    "showUnreadOnly": {
      "type": "boolean",
      "label": "Afficher seulement non-lus",
      "default": false
    },
    "labelFilter": {
      "type": "select",
      "label": "Filtrer par label",
      "options": ["INBOX", "STARRED", "IMPORTANT", "SENT", "DRAFT"],
      "default": "INBOX"
    },
    "appearance": { "type": "section", "label": "Apparence" },
    "theme": {
      "type": "select",
      "label": "Thème",
      "options": [
        { "value": "auto", "label": "Auto (système)" },
        { "value": "dark", "label": "Sombre" },
        { "value": "light", "label": "Clair" }
      ],
      "default": "auto"
    },
    "compactMode": {
      "type": "boolean",
      "label": "Mode compact",
      "default": false
    }
  },

  "defaultLayout": {
    "xPercent": 80,
    "yPercent": 10,
    "widthPercent": 25,
    "heightPercent": 40
  }
}
```

---

## 5. Points de complexité

### Moyenne complexité

1. **Re-authentification avec nouveaux scopes**
   - Le système `requestScopes()` existe déjà
   - L'utilisateur devra accepter les scopes Gmail
   - Flow déjà implémenté dans `oauthProxyApi.ts`

2. **Parsing des emails Gmail**
   - Les emails sont en format MIME encodé Base64
   - Nécessite décoder les headers et le body
   - Gérer HTML vs plain text

3. **Gestion du rate limiting Gmail**
   - 250 quota units/user/second
   - Implémenter un cache local intelligent

### Haute complexité (pour plus tard)

1. **Push notifications en temps réel**
   - Nécessite Google Cloud Pub/Sub
   - Configuration backend supplémentaire
   - Alternative : polling toutes les X minutes

2. **Multi-comptes**
   - Actuellement 1 compte Google par utilisateur
   - Nécessiterait refactoring OAuth store

---

## 6. Prérequis à configurer

### Côté Google Cloud Console

| Action | Obligatoire | Détail |
|--------|-------------|--------|
| Activer Gmail API | Oui | Dans APIs & Services |
| Ajouter scopes OAuth | Oui | `gmail.readonly` minimum |
| Vérification app | Peut-être | Si scopes sensibles |
| Domaines autorisés | Oui | Callback URLs |

### Côté Backend MyWallPaper

| Action | Obligatoire | Détail |
|--------|-------------|--------|
| Whitelist endpoints Gmail | Oui | Dans le proxy OAuth |
| Stocker nouveaux scopes | Oui | Table user_oauth_scopes |
| Gérer refresh tokens | Déjà fait | Token refresh automatique |

### Côté Frontend (Addon)

| Action | Obligatoire | Détail |
|--------|-------------|--------|
| Créer l'addon | Oui | Code dans `src/` |
| Parser emails MIME | Oui | Fonction de décodage |

---

## 7. Estimation de faisabilité

| Élément | Faisabilité | Notes |
|---------|-------------|-------|
| Architecture addon | 100% | SDK v2.0 parfait pour ça |
| OAuth Google | 90% | Juste ajouter scopes Gmail |
| Lecture emails | 95% | API Gmail standard |
| Actions emails | 85% | Nécessite scope `modify` |
| UI/UX Widget | 100% | Liberté totale dans l'addon |
| Multi-provider (futur) | 70% | Outlook/Yahoo = OAuth séparé |

---

## 8. Fichiers de référence MyWallPaper

| Chemin | Description |
|--------|-------------|
| `/frontend/src/shared/lib/addon-sdk/types.ts` | Types SDK v2.0 |
| `/frontend/src/shared/lib/addon-sdk/index.ts` | Exports SDK |
| `/frontend/src/shared/lib/addon-sdk/client/addon-client.ts` | Référence API injectée |
| `/frontend/src/shared/lib/addon-sdk/messageProtocol.ts` | Communication |
| `/frontend/src/shared/lib/addon-sdk/eventBus.ts` | Système événements |
| `/frontend/src/shared/lib/addon-sdk/security.ts` | Sécurité CSP/Sandbox |
| `/frontend/src/shared/lib/addonMessaging.ts` | Race condition handler |
| `/frontend/src/shared/lib/addonConfig.ts` | Manifest loading/validation |
| `/frontend/src/shared/api/oauth-service.ts` | OAuth providers |
| `/frontend/src/shared/api/oauthProxyApi.ts` | OAuth proxy pour addons |
| `/frontend/src/shared/api/authApi.ts` | Auth endpoints |
| `/frontend/src/shared/lib/stores/authStore.ts` | Auth state (Zustand) |
| `/frontend/src/shared/lib/stores/addonPermissionStore.ts` | Permission state |
| `/frontend/src/features/addons/api/addonsApi.ts` | Addon CRUD API |
| `/packages/addon-sdk/examples/` | 3 exemples complets |

---

## 9. API Gmail - Référence rapide

### Endpoints principaux

```
GET  /gmail/v1/users/me/profile           # Profil utilisateur
GET  /gmail/v1/users/me/labels            # Liste des labels
GET  /gmail/v1/users/me/messages          # Liste des messages
GET  /gmail/v1/users/me/messages/{id}     # Détail d'un message
POST /gmail/v1/users/me/messages/{id}/modify  # Modifier labels
POST /gmail/v1/users/me/messages/{id}/trash   # Mettre à la corbeille
GET  /gmail/v1/users/me/threads           # Liste des threads
GET  /gmail/v1/users/me/threads/{id}      # Détail d'un thread
```

### Paramètres de recherche courants

```
q=is:unread              # Non lus
q=is:starred             # Étoilés
q=from:email@domain.com  # De cet expéditeur
q=subject:keyword        # Sujet contenant
q=after:2026/01/01       # Après cette date
labelIds=INBOX           # Dans la boîte de réception
maxResults=10            # Limite
```

### Format de réponse message

```json
{
  "id": "message_id",
  "threadId": "thread_id",
  "labelIds": ["INBOX", "UNREAD"],
  "snippet": "Aperçu du message...",
  "payload": {
    "headers": [
      { "name": "From", "value": "sender@email.com" },
      { "name": "To", "value": "recipient@email.com" },
      { "name": "Subject", "value": "Sujet du mail" },
      { "name": "Date", "value": "Sat, 01 Feb 2026 10:00:00 +0000" }
    ],
    "body": {
      "data": "base64_encoded_content"
    },
    "parts": [ /* multipart content */ ]
  },
  "internalDate": "1706781600000"
}
```

---

## 10. Sécurité - Flow OAuth Addon

```
1. Addon → Host: requestPermission('oauth:google')
                              ↓
2. Host → User: Modal permission (reason visible)
                              ↓
3. User → Host: Grant permission
                              ↓
4. Host → Backend: Store permission grant
                              ↓
5. Addon → Host: oauth.request('google', '/gmail/v1/users/me/messages')
                              ↓
6. Host → Backend: POST /oauth/proxy { provider, endpoint }
                   + JWT token
                              ↓
7. Backend: Decrypt stored OAuth token + make API call to Gmail
                              ↓
8. Backend → Host: Response data (token NEVER exposed)
                              ↓
9. Host → Addon: Forwards response via postMessage
```

**Points clés de sécurité :**
- Sandbox iframe : `allow-scripts allow-forms` seulement
- CSP restrictive
- Tokens OAuth stockés côté backend (hashed + encrypted)
- Rate limiting messages
- Validation origin + iframe source matching
- Network whitelist dans manifest.json
