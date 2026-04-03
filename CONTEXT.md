# Contexte du projet

## Projet
**UniChat** — Application desktop macOS de messagerie unifiée, centralisant 3 comptes WhatsApp, 1 Messenger et 1 Teams dans des webviews isolées, en remplacement de Beeper (10€/mois).

## Stack technique
**Electron** (Chromium bundlé) + React + TypeScript — décision prise après recherche Phase 1.
- Session isolation via `partition="persist:service-id"` (natif Electron)
- Notifications via Electron Notification API + `app.dock.setBadge()`
- Référence : Ferdium (open source, même stack, même besoin)

## Dernière mise à jour
2026-04-03 19:30

## Ce qu'on a fait
- 2026-04-03 : Initialisation du projet (Git, CONTEXT.md, .gitignore)
- 2026-04-03 : Phase 1 de recherche complétée. Analyse de Beeper, Franz, Ferdium, Rambox, Tangram. Rapport complet dans `RECHERCHE_PHASE1.md`

## Où on en est
**Phase 1 terminée. Prêt pour Phase 2 (développement).**

Conclusions clés de la recherche :
- Multi-sessions WhatsApp Web : **OUI, faisable** avec partitions Electron isolées
- Framework choisi : **Electron** (Chromium = compatibilité WhatsApp/Messenger/Teams garantie)
- Tauri écarté : isolation de session non native (issue #11491 fermée "not planned")
- Swift/WKWebView écarté : UA WebKit rejeté par WhatsApp, API complexe
- Ferdium (GitHub) = référence directe pour l'implémentation

## Architecture et décisions

### Stack décidée
- **Electron** + React + TypeScript
- 5 webviews avec partitions complètement isolées :
  - `persist:wa-perso` → WhatsApp numéro 1
  - `persist:wa-pro1` → WhatsApp numéro 2
  - `persist:wa-pro2` → WhatsApp numéro 3
  - `persist:messenger` → Messenger
  - `persist:teams` → Teams

### Points techniques clés
- `disablewebsecurity: true` nécessaire sur les webviews WhatsApp (requis pour QR code et médias)
- UA Chromium = accepté par WhatsApp sans spoofing
- Notifications : MutationObserver dans chaque webview → IPC → main process → `app.dock.setBadge()` + Notification API

### Besoins confirmés
- 3 comptes WhatsApp (3 numéros, 3 téléphones) → 3 instances WhatsApp Web
- 1 Messenger → messenger.com
- 1 Teams → teams.microsoft.com
- Sessions isolées et persistantes (pas de re-scan QR)
- Badge par service dans la sidebar + badge global Dock
- Notifications natives macOS
- Raccourcis clavier Cmd+1 à Cmd+5
- App locale, pas de backend

## Ce qu'il reste à faire
- [x] Initialiser le projet
- [x] **Phase 1** : Recherche et analyse des apps existantes
- [x] **Phase 1** : Valider la faisabilité multi-sessions WhatsApp Web
- [x] **Phase 1** : Choisir le framework (→ Electron)
- [x] **Phase 1** : Identifier les restrictions connues
- [x] **Phase 1** : Produire le rapport `RECHERCHE_PHASE1.md`
- [ ] **Phase 2** : Scaffolding Electron + React + TypeScript
- [ ] **Phase 2** : Sidebar avec liste des 5 services
- [ ] **Phase 2** : 5 webviews avec partitions isolées
- [ ] **Phase 2** : Persistance des sessions (données Electron dans userData)
- [ ] **Phase 2** : Système de badges (MutationObserver → IPC → Dock)
- [ ] **Phase 2** : Notifications macOS natives
- [ ] **Phase 2** : Raccourcis clavier Cmd+1 à Cmd+5
- [ ] **Phase 2** : Lancement au démarrage (optionnel)
- [ ] **Phase 2** : Icône et design minimaliste macOS

## Risques identifiés
- RAM : ~600 MB pour 5 webviews — trade-off accepté
- WhatsApp ToS : pas de restriction technique active actuellement
- Sessions WhatsApp limitées à 5 appareils liés par numéro (côté WhatsApp, pas webview)
