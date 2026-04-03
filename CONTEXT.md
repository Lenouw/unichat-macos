# Contexte du projet

## Projet
**UniChat** — Application desktop macOS de messagerie unifiée, centralisant 3 comptes WhatsApp, 1 Messenger et 1 Teams dans des webviews isolées, en remplacement de Beeper (10€/mois).

## Stack technique
**Electron-vite** + React 18 + TypeScript + Tailwind CSS v4 + electron-builder.
- Session isolation via `partition="persist:service-id"` (natif Electron/Chromium)
- Badges via polling `webview.getTitle()` toutes les 2s
- Notifications via interception `window.Notification` + postMessage + IPC
- Tests : vitest 16 tests (5 config + 6 Sidebar + 5 badge parsing)

## Dernière mise à jour
2026-04-03 ~21:00

## Ce qu'on a fait
- 2026-04-03 : Phase 1 recherche complétée (rapport dans `RECHERCHE_PHASE1.md`)
- 2026-04-03 : Plan Phase 2 écrit (10 tâches, dans `docs/superpowers/plans/2026-04-03-unichat-mvp.md`)
- 2026-04-03 : Phase 2 **COMPLÈTE** — 10 tâches exécutées via sous-agents séquentiels avec double review (spec + qualité) après chaque tâche

## Où on en est
**MVP COMPLET. Deux DMGs buildés et signés :**
- `unichat/dist/UniChat-1.0.0-arm64.dmg` (Apple Silicon)
- `unichat/dist/UniChat-1.0.0.dmg` (Intel x64)

L'app est prête à être installée et testée. Prochaine étape : scan des QR codes WhatsApp, test des notifications, test des raccourcis clavier Cmd+1-5.

## Architecture et décisions

### Stack finale
- **Electron-vite** + React 18 + TypeScript + Tailwind CSS v4
- **5 webviews** avec partitions isolées :
  - `persist:wa-perso` → WhatsApp numéro 1
  - `persist:wa-pro1` → WhatsApp numéro 2
  - `persist:wa-pro2` → WhatsApp numéro 3
  - `persist:messenger` → Messenger
  - `persist:teams` → Teams

### Décisions de performance
- **Lazy load** : les webviews ne sont créées dans le DOM qu'à la première visite
- **CSS show/hide** : changer d'onglet = `display: flex/none`, jamais unmount/remount (0ms)
- **Badge polling** : `webview.getTitle()` toutes les 2s, pas d'injection DOM
- **UA Chrome** : `Chrome/124.0.0.0` forcé pour compatibilité WhatsApp/Messenger

### Structure des fichiers clés
```
unichat/
├── src/main/index.ts           # Main process : BrowserWindow, IPC, Dock badge, raccourcis
├── src/preload/index.ts        # contextBridge : setBadge, notify, onServiceSelect
└── src/renderer/src/
    ├── App.tsx                 # Layout root : Sidebar + WebviewManager
    ├── config/services.ts      # 5 services (id, url, partition, couleur)
    └── components/
        ├── Sidebar.tsx         # Boutons colorés avec badges
        ├── WebviewManager.tsx  # Lazy load + show/hide + polling + notifications
        └── badge.ts            # parseBadgeFromTitle (testable isolément)
```

### Leçon apprise (sous-agents)
Les sous-agents Haiku suppriment systématiquement la clé `test` dans `electron.vite.config.ts` (considérée "invalide" sans le type vitest). Solution finale : ajout de `"vitest/config"` dans `tsconfig.node.json`. Désormais le typecheck complet passe sans erreur.

## Ce qu'il reste à faire
- [x] Phase 1 : Recherche et choix technique
- [x] Phase 2 : MVP complet (10 tâches)
- [ ] **Test réel** : installer le DMG, scanner les QR codes, valider les sessions
- [ ] **Icône définitive** : remplacer l'icône placeholder verte par une vraie icône UniChat
- [ ] **Optionnel** : lancement au démarrage macOS (`app.setLoginItemSettings`)
- [ ] **Optionnel** : labels personnalisables pour les 3 comptes WhatsApp

## Problèmes connus
- Notarization Apple skippée (pas de provisioning profile) — normal pour usage privé
- L'erreur TS `test does not exist` sur `electron.vite.config.ts` était présente jusqu'à la Task 10 (corrigée via `tsconfig.node.json`)
