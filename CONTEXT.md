# Contexte du projet

## Projet
**UniChat** — Application desktop macOS de messagerie unifiée, centralisant 3 comptes WhatsApp, 1 Messenger et 1 Teams dans des webviews isolées, en remplacement de Beeper (10€/mois).

## Stack technique
À définir après la Phase 1 de recherche. Candidats : Electron, Tauri, ou Swift + WKWebView natif.

## Dernière mise à jour
2026-04-03 19:14

## Ce qu'on a fait
- 2026-04-03 : Initialisation du projet. Lancement de la Phase 1 de recherche (analyse des apps existantes : Beeper, Franz, Ferdi, Ferdium, Rambox, Tangram).

## Où on en est
**Phase 1 — Recherche en cours.** Aucun code écrit. La recherche doit confirmer la faisabilité technique avant tout développement.

## Architecture et décisions
### Besoins confirmés
- 3 comptes WhatsApp (3 numéros, 3 téléphones) → 3 instances WhatsApp Web
- 1 compte Facebook Messenger → messenger.com ou web.facebook.com/messages
- 1 compte Microsoft Teams → teams.microsoft.com
- Sessions isolées (cookies/localStorage séparés par instance)
- Persistance des sessions (pas de re-scan QR code à chaque lancement)
- App locale uniquement — pas de backend, pas de serveur

### Contraintes
- macOS uniquement
- Le plus léger possible (MacBook Air)
- Notifications natives macOS
- Raccourcis clavier (Cmd+1, Cmd+2…)
- Sidebar ou onglets pour naviguer entre comptes

## Ce qu'il reste à faire
- [x] Initialiser le projet
- [ ] **Phase 1** : Recherche et analyse des apps existantes (Beeper, Franz, Ferdi, Ferdium, Rambox, Tangram)
- [ ] **Phase 1** : Valider la faisabilité de multi-sessions WhatsApp Web dans des webviews isolées
- [ ] **Phase 1** : Choisir le framework (Electron vs Tauri vs Swift/WKWebView)
- [ ] **Phase 1** : Identifier les restrictions connues (user-agent, blocage webview, etc.)
- [ ] **Phase 1** : Produire le rapport de recherche structuré
- [ ] **Phase 2** : Développement du MVP (après validation Phase 1)
