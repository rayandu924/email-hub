# Email Hub Addon - MyWallPaper

Ce projet est un addon pour l'application MyWallPaper qui centralise les emails en un seul widget.

## Contexte

- **Application parente** : MyWallPaper (`/home/rayandu924/actions-runner/_work/rust-k8s-microservices/rust-k8s-microservices`)
- **SDK Addon** : v2.0 avec support OAuth, Storage API, Network API
- **Provider initial** : Gmail (Google)
- **Providers futurs** : Outlook, Yahoo

## Documentation

- Audit complet : `docs/AUDIT.md`
- Guide Google Cloud : `docs/GOOGLE_CLOUD_SETUP.md`

## Architecture MyWallPaper (références)

### Fichiers clés du SDK Addon
- Types SDK : `/frontend/src/shared/lib/addon-sdk/types.ts`
- Client API : `/frontend/src/shared/lib/addon-sdk/client/addon-client.ts`
- OAuth Service : `/frontend/src/shared/api/oauth-service.ts`
- OAuth Proxy : `/frontend/src/shared/api/oauthProxyApi.ts`
- Exemples : `/packages/addon-sdk/examples/`

### OAuth Google existant
- Scopes actuels : `openid email profile`
- Scopes Gmail requis : `gmail.readonly`, `gmail.labels`, `gmail.modify`

## Phases de développement

1. **Phase 1 (MVP)** - Lecture seule Gmail
2. **Phase 2** - Actions (archiver, marquer lu, supprimer)
3. **Phase 3** - Multi-provider (Outlook, Yahoo)

## Structure de l'addon

```
/
├── manifest.json       # Configuration addon + OAuth + Settings
├── index.html          # Point d'entrée HTML
├── styles.css          # Styles (dark/light theme)
├── app.js              # Logique principale
├── lib/
│   ├── gmail-api.js    # Wrapper API Gmail via OAuth proxy
│   └── email-parser.js # Parser emails MIME/Base64
└── docs/               # Documentation
```

## Utilisation de l'API Gmail

L'addon utilise le provider `google` existant avec les endpoints Gmail :

```javascript
// Via le OAuth proxy (tokens jamais exposés)
await api.oauth.request('google', '/gmail/v1/users/me/messages');
```

## Commandes utiles

```bash
# Aller au projet parent
cd /home/rayandu924/actions-runner/_work/rust-k8s-microservices/rust-k8s-microservices

# Voir les exemples d'addons
ls /home/rayandu924/actions-runner/_work/rust-k8s-microservices/rust-k8s-microservices/packages/addon-sdk/examples/

# Tester l'addon localement (serveur HTTP simple)
cd /home/rayandu924/email-hub && npx serve . --cors -l 5174
```
