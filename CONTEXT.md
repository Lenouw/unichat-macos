# Contexte du projet

## Projet
**UniChat** — Application desktop macOS de messagerie unifiée, centralisant des comptes WhatsApp, Messenger, Teams, Instagram, Telegram, Slack, Discord, LinkedIn dans des webviews isolées, en remplacement de Beeper (10€/mois). Les comptes sont désormais dynamiques : l'utilisateur peut en ajouter/supprimer/renommer autant qu'il veut.

## Stack technique
**Electron-vite** + React 18 + TypeScript + Tailwind CSS v4 + electron-builder + electron-updater.
- Session isolation via `partition="persist:X"` (natif Electron/Chromium)
- Badges via polling `webview.getTitle()` toutes les 4s
- Notifications via interception `window.Notification` → queue `window.__unichatNotifQueue` → drain via `executeJavaScript` (postMessage ne traverse pas les webviews Electron)
- Comptes dynamiques stockés en localStorage (`unichat:accounts`) avec validation stricte
- Auto-update via `electron-updater` (GitHub Releases) — code prêt, hébergement à configurer
- Tests : vitest 17 tests (5 config + 7 Sidebar + 5 badge parsing)

## Dernière mise à jour
2026-04-03 ~23:20

## Ce qu'on a fait

- 2026-04-03 (session 2) : Refonte complète en comptes dynamiques (v1.2.0 → v1.3.1)
  - Persistance des sessions WhatsApp : `app.setPath('userData', ...)` forcé à `~/Library/Application Support/UniChat/` pour que dev et prod partagent le même dossier
  - Permissions micro : `session.setPermissionRequestHandler` sur toutes les partitions (connues + nouvelles via `session-created`)
  - **Rename** : double-clic sur un label dans la sidebar → édition inline → sauvegarde localStorage
  - **Comptes dynamiques** : `accounts.ts` avec CRUD localStorage, validation stricte (URL contre catalogue, partition regex, ID regex), migration automatique des 5 comptes hardcodés existants
  - **AddAccountModal** : grille 8 services (WA, Messenger, Teams, Instagram, Telegram, Slack, Discord, LinkedIn) + palette 15 couleurs + label personnalisable
  - **Suppression** : hover → bouton ×, 1er clic rouge + !, 2e clic confirme (2s timeout)
  - **Logos dans sidebar** : emoji du service dans cercle coloré + pastille lettre du nom custom
  - **Auto-update** : electron-updater intégré, bannière verte dans sidebar si mise à jour dispo, bouton "Redémarrer pour installer"
  - **Versioning** : `__APP_VERSION__` injecté au build via `define`, affiché en bas de sidebar
  - **Fix notifications** : remplacement de `window.postMessage` (ne fonctionne pas webview→parent dans Electron) par queue `window.__unichatNotifQueue` drainée via `executeJavaScript` toutes les 4s
  - **Fix permissions sessions existantes** : `session.fromPartition()` explicite sur les 5 partitions connues au démarrage (session-created ne fire pas pour les sessions déjà sur disque)

- 2026-04-03 (session 1) : MVP complet (v1.0.0)
  - Phase 1 recherche complétée (rapport dans `RECHERCHE_PHASE1.md`)
  - Phase 2 : 10 tâches exécutées via sous-agents séquentiels avec double review
  - Security audit + hardening (IPC validation, disablewebsecurity removed, listener leak fix)
  - UX redesign sidebar (260px, noms complets, dernier contact)
  - GitHub repo créé : `Lenouw/unichat-macos`

## Où on en est
**v1.3.1 buildée et signée :**
- `unichat/dist/UniChat-1.3.1-arm64.dmg` (Apple Silicon — à installer)
- `unichat/dist/UniChat-1.3.1.dmg` (Intel x64)

**Fonctionnel :**
- 5 comptes par défaut (3 WA + Messenger + Teams) avec sessions persistantes
- Ajout/suppression/renommage de comptes depuis l'UI
- 8 services supportés dans le modal d'ajout
- Badges dans sidebar + icône Dock macOS
- Notifications natives (corrigées)
- Permissions micro pour vocaux (corrigées)
- Auto-update code prêt — manque l'hébergement (voir "Ce qu'il reste à faire")

**Non fonctionnel / à valider :**
- Auto-update : code OK mais pas de releases GitHub publiées → le check échoue silencieusement
- Notarization Apple skippée (usage privé, normal)

## Architecture et décisions

### Fichiers clés
```
unichat/
├── src/main/index.ts              # Main process : autoUpdater, IPC, permissions sessions, raccourcis
├── src/preload/index.ts           # contextBridge : setBadge, notify, onServiceSelect, registerAccounts, onUpdateStatus, installUpdate
├── src/preload/index.d.ts         # Types TypeScript du bridge
└── src/renderer/src/
    ├── App.tsx                    # Root : gestion état comptes, badges, senders, update status
    ├── env.d.ts                   # Déclaration __APP_VERSION__ (optionnel pour les tests)
    ├── test-setup.ts              # Setup vitest : injecte __APP_VERSION__ = 'test'
    ├── config/
    │   ├── serviceTypes.ts        # Catalogue des 8 services supportés (URL, couleur, emoji)
    │   ├── accounts.ts            # CRUD comptes localStorage + validation stricte sécurité
    │   └── version.ts             # Export APP_VERSION avec fallback 'dev' pour les tests
    └── components/
        ├── Sidebar.tsx            # Liste dynamique + ServiceIcon + UpdateBanner + bouton ajout
        ├── WebviewManager.tsx     # Lazy load + polling badge/sender/notifs via executeJavaScript
        ├── AddAccountModal.tsx    # Modal ajout compte (grille services + palette couleurs)
        └── badge.ts               # parseBadgeFromTitle (testable isolément)
```

### Décisions importantes

**Stockage comptes (localStorage)** : On ne stocke QUE la config (label, serviceKey, couleur, partition ID). Jamais de credentials. Les sessions (cookies/tokens) restent dans le dossier Electron userData protégé par l'OS. Validation stricte à la lecture : URL contre catalogue connu, ID et partition contre regex, couleur hex valide.

**Notifications (fix critique)** : `window.postMessage` depuis une webview ne remonte PAS au renderer parent dans Electron (contrairement aux iframes web classiques). Solution : injecter une queue `window.__unichatNotifQueue` dans la webview, drainer via `executeJavaScript` toutes les 4s. Testé et fonctionnel.

**Permissions sessions** : `app.on('session-created')` ne fire que pour les NOUVELLES sessions. Les sessions `persist:*` déjà sur disque ne reçoivent jamais cet event. Fix : appel explicite à `session.fromPartition()` pour chaque partition connue au démarrage de l'app.

**userData stable** : `app.setPath('userData', '~/Library/Application Support/UniChat')` forcé avant `app.whenReady()`. Garantit que dev et prod partagent les mêmes sessions → plus besoin de rescanner les QR codes après chaque rebuild.

**Auto-update** : electron-updater (electron-builder) au lieu de Sparkle (framework natif macOS non compatible Electron). Même UX pour l'utilisateur final. Nécessite GitHub Releases public ou hébergement HTTPS pour fonctionner.

**Raccourcis Cmd+1-9** : dynamiques, enregistrés dans main via IPC `accounts:register` envoyé par le renderer au démarrage (et à chaque changement de liste de comptes).

## Ce qu'il reste à faire
- [x] Phase 1 : Recherche et choix technique
- [x] Phase 2 : MVP complet (10 tâches)
- [x] Security audit et hardening
- [x] UX redesign sidebar (260px, noms complets, dernier contact)
- [x] Comptes dynamiques (ajout/suppression/renommage)
- [x] 8 services supportés
- [x] Logos + première lettre dans sidebar
- [x] Persistance sessions entre builds (userData stable)
- [x] Permissions micro corrigées
- [x] Notifications corrigées (queue executeJavaScript)
- [x] electron-updater intégré (code)
- [x] Versioning visible dans l'app
- [ ] **Installer v1.3.1** : DMG arm64 à glisser dans /Applications (dernière install manuelle)
- [ ] **Auto-update hébergement** : choisir public repo GitHub OU hébergement alternatif, puis publier les releases avec `GH_TOKEN=xxx npm run build:mac -- --publish always`
- [ ] **Test réel** : valider badges, notifications, vocaux, Cmd+1-N après install v1.3.1
- [ ] **Icône définitive** : remplacer l'icône placeholder verte
- [ ] **Optionnel** : lancement au démarrage macOS (`app.setLoginItemSettings`)

## Problèmes connus
- Auto-update non fonctionnel tant que l'hébergement n'est pas configuré (silencieux, pas d'erreur visible)
- Pour les comptes ajoutés dynamiquement : `session-created` couvre les permissions, mais uniquement si la session est créée APRÈS le démarrage de l'app (cas nominal). Les comptes créés dans une session précédente sont couverts par `session.fromPartition()` seulement si leurs IDs sont dans la liste `knownPartitions` de `main/index.ts` — à corriger si l'utilisateur ajoute beaucoup de comptes (TODO: lire la liste depuis localStorage au démarrage du main process).
- Notarization Apple skippée (pas de provisioning profile) — normal pour usage privé
