# Rapport Phase 1 — Analyse des apps de messagerie unifiée

*Date : 2026-04-03*

## 1. Synthèse des apps existantes

### Beeper (beeper.com)
**Architecture :** Fondamentalement différent des autres — Beeper n'est pas un agrégateur de webviews. C'est une app native construite sur le protocole **Matrix** avec un système de "bridges" qui traduit chaque réseau de messagerie (WhatsApp, iMessage, etc.) en protocole Matrix unifié.

- **Framework :** App native (React Native / Kotlin / Swift selon plateforme), sans webview pour les services
- **Gestion des sessions :** Les bridges accèdent directement aux APIs/protocoles des services. Depuis 2024, bridges en local sur l'appareil ("on-device")
- **Multi-comptes :** Supporté nativement via les bridges Matrix
- **Acquisition :** Racheté par Automattic (WordPress) en janvier 2025
- **Point critique :** Beeper ne fait PAS de webview — il implémente les protocoles des services. Approche puissante mais très lourde à reproduire. **Pas reproductible pour ce projet.**

### Franz (meetfranz.com)
**Architecture :** Electron + webviews isolées par partition.

- **Framework :** Electron avec `<webview>` tags
- **Session isolation :** Via `partition="persist:service-id"` — chaque service a son propre espace cookies/localStorage
- **Multi-comptes :** Même service ajouté plusieurs fois avec partition IDs différents
- **État :** Peu maintenu en 2024-2025. Ferdium est le fork actif.

### Ferdium (ferdium.org) — Fork actif de Franz/Ferdi
**Architecture :** Electron 35-37 + React 18 + MobX + TypeScript.

- **Framework :** Electron (mis à jour activement, releases régulières 2025)
- **Session isolation :** Sandboxes nommées `sandbox-{number}`. Chaque service dans son propre `<webview>` avec partition unique
- **WhatsApp :** Recipe dédiée sur `web.whatsapp.com` avec `disablewebsecurity: true` (nécessaire)
- **Notifications :** Recipes injectent du JS pour lire les badges → IPC vers main process Electron
- **Multi-comptes WhatsApp :** Techniquement possible (service ajouté N fois avec sandbox séparée)
- **Code source :** https://github.com/ferdium/ferdium-app

### Rambox (rambox.app)
**Architecture :** Electron + ExtJS.

- **Framework :** Electron avec webviews isolées
- **Session isolation :** Partition `persist:rambox` par service. Cookies, localStorage et cache totalement séparés
- **Multi-comptes :** Via duplication de service — même URL deux fois = deux sessions indépendantes

### Tangram
**Non applicable** — App Linux uniquement (GNOME/GTK). Hors scope macOS.

---

## 2. Faisabilité technique — WhatsApp Web multi-sessions

**OUI, c'est faisable** — sous conditions précises.

### Mécanisme confirmé
WhatsApp Web stocke sa session dans localStorage et cookies. Deux webviews avec espaces de stockage totalement isolés maintiennent chacune une session indépendante. C'est l'équivalent de deux profils Chrome séparés.

**Preuve pratique :** Ferdium, Franz, Rambox permettent tous de faire tourner plusieurs instances WhatsApp Web simultanément. Des outils commerciaux (GoLogin, WADesk) sont construits sur ce principe.

### Conditions techniques
1. **Isolation parfaite obligatoire** : Un cookie partagé entre deux sessions provoque un logout immédiat
2. **User-agent :** WhatsApp vérifie le UA. Electron/Chromium passe sans modification. WKWebView nécessite un spoofing vers un UA Chrome
3. **`disablewebsecurity: true`** : Ferdium l'active pour WhatsApp — nécessaire pour les médias et le QR code
4. **Pas de ban connu :** WhatsApp ne bloque pas activement les webviews isolées avec cookies propres

---

## 3. Comparatif des frameworks

| Critère | Electron | Tauri 2.0 | Swift + WKWebView |
|---|---|---|---|
| **Moteur webview** | Chromium (bundlé) | WKWebView (WebKit) | WKWebView (WebKit) |
| **Session isolation** | ✅ Natif via `partition="persist:X"` | ⚠️ Partiel (issue #11491 fermée "not planned") | ⚠️ Via `WKWebsiteDataStore` — complexe |
| **User-agent WhatsApp** | ✅ Chromium accepté | ❌ WebKit rejeté — spoofing requis | ❌ WebKit rejeté — spoofing requis |
| **RAM** | ~400 MB pour 5-6 webviews | ~170 MB | ~150-200 MB |
| **Bundle size** | 200-300 MB | 8-15 MB | ~10-30 MB |
| **Notifications macOS** | ✅ Bien intégré | ✅ Supporté | ✅ Natif (meilleur) |
| **Compatibilité WhatsApp** | ✅ Excellente | ❌ Risquée | ❌ Risquée |
| **Compatibilité Messenger** | ✅ Excellente | ❌ Risquée | ❌ Risquée |
| **Compatibilité Teams** | ✅ Excellente | ❌ Risquée | ❌ Risquée |
| **Proof of concept existant** | ✅ Ferdium, Franz, Rambox | ❌ Non | ❌ Non |
| **Temps de dev** | Court | Moyen (Rust requis) | Long |

---

## 4. Restrictions et pièges connus

### WhatsApp Web
- **User-agent :** Electron/Chromium passe. WKWebView nécessite spoofing vers Chrome UA
- **`disablewebsecurity`** requis pour QR code et médias dans webview isolé
- **Expiration de session :** Si le téléphone est offline ou si la limite de 5 appareils liés est atteinte (côté protocole WhatsApp, pas webview)
- **Pas de blocage X-Frame-Options** : WhatsApp Web charge bien dans un webview top-level

### Messenger (Facebook)
- **Login OAuth tiers bloqué** depuis 2021 (anti-phishing). Mais `messenger.com` en webview autonome (non iframe) fonctionne normalement
- **User-agent :** Chromium UA sans problème

### Microsoft Teams
- **Blocage iframe** : `login.microsoftonline.com` envoie `X-Frame-Options: deny` — mais un webview top-level (pas iframe) fonctionne
- **Bandeau d'avertissement** possible ("Teams n'est pas dans l'app native") mais fonctionnel
- Rambox et Ferdium supportent Teams avec cette approche

### Pièges transversaux
- **RAM :** ~600-750 MB pour 5 services — trade-off accepté, documenté
- **Notification permission** : Chaque webview demande la permission séparément — apparaissent toutes sous le nom de l'app principale

---

## 5. Gestion des notifications

### Comment Ferdium le fait (recipe injection)
1. Script JS injecté dans chaque webview au chargement
2. Script inspecte le DOM pour compter les messages non lus
3. Expose `window.ferdi.setBadge(count)` → IPC vers main process Electron
4. Main process : `app.dock.setBadge(totalCount)` pour le badge Dock
5. Pour les notifs : intercept de `new Notification()` dans le webview → rerouté via Electron (APIs macOS natives)

### Pour UniChat
```
webview → MutationObserver sur les badges → postMessage vers main process
→ main process : app.dock.setBadge(total) + Notification API macOS
→ badge individuel dans la sidebar par service
```

Granularité clé : badge **par service** (WA perso, WA pro 1, WA pro 2) + badge global Dock.

---

## 6. Recommandation finale

### Framework : **Electron**

**Architecture suggérée :**
```
App Electron (main process)
├── Sidebar (React)
│   └── Liste des services avec badges individuels
└── Services (webviews avec partition isolée)
    ├── WhatsApp Perso   → partition="persist:wa-perso"
    ├── WhatsApp Pro 1   → partition="persist:wa-pro1"
    ├── WhatsApp Pro 2   → partition="persist:wa-pro2"
    ├── Messenger        → partition="persist:messenger"
    └── Teams            → partition="persist:teams"
```

**Pourquoi Electron plutôt que Tauri :**
1. Session isolation native (`partition="persist:X"`) — le mécanisme le plus testé pour ce cas
2. Chromium = WhatsApp/Messenger/Teams compatibles sans spoofing
3. Ferdium est open source et couvre exactement ce besoin — code directement référençable
4. Notifications macOS bien intégrées

**Pourquoi pas Swift + WKWebView :**
- `WKWebsiteDataStore` complexe et historiquement bugué
- UA WebKit rejeté par WhatsApp sans spoofing
- Beaucoup plus de code pour le même résultat

**Option recommandée :** Partir de Ferdium comme référence/inspiration (voire fork allégé). La base Electron + React + partitions est exactement ce qu'il faut.

---

## 7. Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| WhatsApp change sa détection webview | Faible | Élevé | Spoofing UA Chrome, surveiller issues Ferdium |
| Teams bloque l'auth en webview top-level | Faible | Moyen | Fonctionne actuellement, surveiller annonces MS |
| RAM excessive (5+ webviews) | Certaine | Moyen | ~600 MB attendus — acceptable, documenter |
| Sessions WhatsApp expirent fréquemment | Possible | Moyen | Limite 5 appareils liés WhatsApp — pas lié au webview |
| Apple durcit WKWebView sur macOS | Faible | Élevé | Electron utilise Chromium, non concerné |
| WhatsApp ToS interdit le multi-compte webview | Faible | Élevé | Aucune restriction technique active actuellement |

**Signal positif :** WhatsApp a migré son app Windows native vers WebView2/Chromium en 2025 — ils acceptent les approches webview.

---

*Sources : code source Ferdium (GitHub/DeepWiki), documentation Electron, issues Tauri #11491 et #9285, documentation Rambox, blog Beeper, restrictions Meta/Microsoft.*
