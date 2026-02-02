# Guide de Configuration Google Cloud Console pour Gmail API

Ce guide détaille les étapes pour configurer l'API Gmail dans Google Cloud Console pour l'addon Email Hub de MyWallPaper.

> **Note importante** : Google a remplacé l'ancien "OAuth consent screen" par la nouvelle interface **Google Auth Platform**. Ce guide utilise la nouvelle interface.

---

## Prérequis

- Accès à Google Cloud Console avec le projet MyWallPaper existant
- Droits d'administration sur le projet

---

## Étape 1 : Activer l'API Gmail

1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. Sélectionner le projet MyWallPaper
3. Menu **APIs & Services** > **Library**
4. Rechercher "Gmail API"
5. Cliquer sur **Gmail API**
6. Cliquer sur **Enable**

### Vérification

Après activation, vous devriez voir Gmail API dans :
- **APIs & Services** > **Enabled APIs & services**

---

## Étape 2 : Configurer Google Auth Platform (nouveau OAuth consent)

> **Important** : L'ancien menu "OAuth consent screen" redirige maintenant vers "Google Auth Platform". C'est normal.

### 2.1 Accéder à Google Auth Platform

1. Menu hamburger (≡) > **Google Auth platform** > **Branding**

   Ou directement : [console.cloud.google.com/auth/branding](https://console.cloud.google.com/auth/branding)

2. Si vous voyez **"Google Auth platform not configured yet"**, cliquer sur **Get Started**

### 2.2 Configuration initiale (si première fois)

**App Information :**
1. **App name** : MyWallPaper (ou le nom déjà utilisé)
2. **User support email** : Sélectionner votre email de support
3. Cliquer **Next**

**Audience :**
1. Sélectionner **External** (pour utilisateurs hors organisation Google Workspace)
2. Cliquer **Next**

**Contact Information :**
1. Entrer votre email pour les notifications
2. Cliquer **Next**

**Finish :**
1. Cocher **I agree to the Google API Services: User Data Policy**
2. Cliquer **Continue**
3. Cliquer **Create**

### 2.3 Ajouter des utilisateurs de test

1. Aller dans **Google Auth platform** > **Audience**
2. Section **Test users** > Cliquer **Add users**
3. Ajouter votre email et autres testeurs
4. Cliquer **Save**

### 2.4 Ajouter les scopes Gmail

1. Aller dans **Google Auth platform** > **Data Access**
2. Cliquer **Add or Remove Scopes**
3. Rechercher et ajouter ces scopes :

| Scope | Description | Catégorie |
|-------|-------------|-----------|
| `https://www.googleapis.com/auth/gmail.readonly` | Lecture des emails | Sensitive |
| `https://www.googleapis.com/auth/gmail.labels` | Gestion des labels | Sensitive |
| `https://www.googleapis.com/auth/gmail.modify` | Modification des emails (Phase 2) | Sensitive |

4. Cliquer **Save**

### Note sur les catégories de scopes

| Catégorie | Vérification requise |
|-----------|---------------------|
| Non-sensitive | Vérification basique uniquement |
| **Sensitive** | Vérification basique + vérification additionnelle |
| Restricted | Vérification basique + additionnelle + audit sécurité |

Les scopes Gmail sont **Sensitive**, donc :
- Affichage d'un avertissement lors du consentement utilisateur
- Vérification additionnelle requise si > 100 utilisateurs

---

## Étape 3 : Créer/Vérifier les Credentials OAuth

### 3.1 Si credentials n'existent pas encore

1. Menu **APIs & Services** > **Credentials**
2. Cliquer **+ Create Credentials** > **OAuth client ID**
3. **Application type** : Web application
4. **Name** : MyWallPaper Web Client
5. **Authorized JavaScript origins** :
   ```
   http://localhost:5173
   https://votre-domaine.com
   ```
6. **Authorized redirect URIs** :
   ```
   http://localhost:5173/auth/callback
   https://votre-domaine.com/auth/callback
   ```
7. Cliquer **Create**
8. **Sauvegarder** le Client ID et Client Secret

### 3.2 Si credentials existent déjà

1. Menu **APIs & Services** > **Credentials**
2. Cliquer sur votre **OAuth 2.0 Client ID** existant
3. Vérifier que les URIs de redirection sont correctes
4. Sauvegarder si modifications

---

## Étape 4 : Configuration Backend MyWallPaper

### 4.1 Variables d'environnement

```env
# Existantes (déjà configurées)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Nouvelles (si nécessaire)
GMAIL_API_SCOPES=https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.labels,https://www.googleapis.com/auth/gmail.modify
```

### 4.2 Whitelist des endpoints Gmail

Dans le proxy OAuth backend, ajouter les endpoints Gmail autorisés :

```rust
// Exemple Rust (backend MyWallPaper)
const GMAIL_ALLOWED_ENDPOINTS: &[&str] = &[
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    "https://gmail.googleapis.com/gmail/v1/users/me/threads",
];
```

### 4.3 Gestion des scopes additionnels

Le backend doit pouvoir :
1. Stocker les scopes accordés par utilisateur
2. Déclencher une re-auth si nouveaux scopes requis
3. Valider les scopes avant les requêtes proxy

---

## Étape 5 : Test de l'intégration

### 5.1 Test manuel OAuth

1. Démarrer l'application en développement
2. Se connecter avec Google
3. Vérifier que le consentement demande les scopes Gmail
4. Accepter et vérifier les tokens

### 5.2 Test API Gmail

Tester une requête simple via le proxy :

```javascript
// Depuis l'addon (ou console dev)
const response = await api.oauth.request('google',
  'https://gmail.googleapis.com/gmail/v1/users/me/profile'
);
console.log(response);
// Devrait afficher : { emailAddress: "user@gmail.com", ... }
```

### 5.3 Test liste des emails

```javascript
const emails = await api.oauth.request('google',
  'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5'
);
console.log(emails);
// Devrait afficher : { messages: [...], resultSizeEstimate: ... }
```

---

## Étape 6 : Publication et Vérification

### Mode Test vs Production

| Mode | Limite | Vérification |
|------|--------|--------------|
| Testing | 100 utilisateurs max (ajoutés manuellement) | Non requise |
| Production | Illimité | Requise pour scopes sensitive |

### Pour passer en Production

1. **Google Auth platform** > **Audience**
2. Section **Publishing status**
3. Cliquer **Publish App**

### Si vérification requise (> 100 users)

Documents nécessaires :
1. **Privacy Policy** - URL publique
2. **Terms of Service** - URL publique
3. **Justification** - Pourquoi vous avez besoin des scopes Gmail
4. **Vidéo démo** - Montrant l'utilisation des données

**Délai** : 2-6 semaines

---

## Quotas et Limites Gmail API

| Limite | Valeur |
|--------|--------|
| Quota units/user/second | 250 |
| Daily quota | 1,000,000,000 units |
| Messages.list | 5 units |
| Messages.get | 5 units |
| Messages.modify | 5 units |

### Bonnes pratiques

1. **Cache local** - Stocker les emails récupérés
2. **Polling raisonnable** - Pas plus d'une requête/minute
3. **Batch requests** - Grouper les requêtes quand possible
4. **Pagination** - Utiliser `pageToken` pour grandes listes

---

## Troubleshooting

### Redirection vers Google Auth Platform au lieu de OAuth consent screen

**C'est normal.** Google a migré vers la nouvelle interface. Utiliser :
- Menu > **Google Auth platform** > **Branding** (infos app)
- Menu > **Google Auth platform** > **Audience** (type + test users)
- Menu > **Google Auth platform** > **Data Access** (scopes)

### Erreur "Access Not Configured"

```
Gmail API has not been used in project XXX before or it is disabled.
```

**Solution** : Activer l'API Gmail (Étape 1)

### Erreur "Insufficient Permission"

```
Request had insufficient authentication scopes.
```

**Solution** :
1. Ajouter les scopes manquants dans **Data Access**
2. Forcer une re-authentification de l'utilisateur (déconnexion/reconnexion)

### Erreur "Access Denied" après consentement

```
Error 403: access_denied
```

**Solutions** :
1. Vérifier que l'app est en mode "Testing" avec votre email ajouté
2. Aller dans **Audience** > **Test users** > Ajouter votre email

### Erreur "App not verified"

Écran d'avertissement "This app isn't verified"

**Solutions** :
1. En développement : Cliquer "Advanced" > "Go to [app] (unsafe)"
2. En production : Soumettre l'app pour vérification

### Erreur "Invalid Redirect URI"

```
Error 400: redirect_uri_mismatch
```

**Solution** :
1. **APIs & Services** > **Credentials** > votre OAuth Client
2. Ajouter l'URI exacte dans "Authorized redirect URIs"
3. Attention aux trailing slashes et http vs https

---

## Checklist finale

- [ ] Gmail API activée dans Library
- [ ] Google Auth Platform configuré (Branding)
- [ ] Audience défini (External) + Test users ajoutés
- [ ] Scopes Gmail ajoutés dans Data Access
- [ ] OAuth Client ID créé/vérifié avec bonnes URIs
- [ ] Variables d'environnement backend mises à jour
- [ ] Endpoints Gmail whitelistés dans le proxy
- [ ] Test de connexion réussi
- [ ] Test de récupération d'emails réussi

---

## Références

- [Configure OAuth consent (nouveau guide)](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Gmail API Reference](https://developers.google.com/gmail/api/reference/rest)
- [OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Gmail API Quotas](https://developers.google.com/gmail/api/reference/quota)
