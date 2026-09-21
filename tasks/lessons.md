# Lessons

## 2026-09-21 | Session WhatsApp détruite en voulant récupérer de l'espace disque

**Ce qui a mal tourné.** Pour récupérer 7,2 Go sur les partitions d'UniChat, suppression
manuelle de `Cache`, `Code Cache`, `GPUCache`, `Service Worker/CacheStorage` et
`Service Worker/ScriptCache`. Vérification faite avant : les clés d'appairage WhatsApp
sont bien dans IndexedDB, que la commande ne touchait pas. Conclusion annoncée à Florian :
« tu ne seras pas déconnecté ».

Faux. Au redémarrage, WhatsApp Web n'a plus reconnu le navigateur, a effacé lui-même sa
base IndexedDB (61 Mo de session sur le compte PRO) et exigé un nouvel appairage. La
session était révoquée côté serveur : ni la restauration par fusion, ni la restauration
par remplacement propre n'ont pu la récupérer. Compte inutilisable jusqu'au retour de
l'iPhone resté au bureau.

**La faute de raisonnement.** La question posée était « où sont stockées les clés ». La
question qui comptait était « qu'est-ce qui identifie ce navigateur auprès du serveur ».
Avoir vérifié la première a donné une fausse assurance sur la seconde.

**Règles.**

1. Ne jamais supprimer le dossier `Service Worker` d'une partition Electron, ni via le
   Finder, ni via `rm`, ni via `clearStorageData()`. Seuls `Cache`, `Code Cache` et
   `GPUCache` sont jetables sans risque, soit 5,4 Go des 7,2 Go dans ce cas : l'écart
   ne justifiait pas le risque pris.
2. Sur une app tierce dont on ne maîtrise pas le protocole d'authentification, une
   vérification partielle ne fonde pas une affirmation totale. Dire « je ne sais pas ce
   que contient ce dossier, on n'y touche pas » plutôt que « c'est sans risque ».
3. Toute opération destructive sur des données de session se fait application FERMÉE, et
   la sauvegarde se vérifie en la restaurant, pas en constatant qu'elle existe.
4. Une restauration se fait par REMPLACEMENT (`rm -rf` de la cible puis copie), jamais
   par fusion. `ditto` sur un dossier existant laisse en place les fichiers écrits
   entre-temps et produit un état leveldb incohérent.
5. Proposer d'abord l'option sûre avec son gain chiffré, et ne présenter l'option plus
   agressive que si le gain la justifie vraiment.

**Correctif appliqué (v1.4.2).** `src/main/cacheManager.ts` n'utilise que `clearCache()`
et `clearCodeCaches()`, avec la règle documentée en tête de fichier. Plafond de cache
disque via `disk-cache-size`, purge automatique au démarrage au-dessus du plafond, et
bouton de purge manuelle dans la barre latérale.

## 2026-09-21 | Trois versions signées livrées avec un crash au lancement

**Ce qui a mal tourné.** `import contextMenu from 'electron-context-menu'` ajouté en
1.4.0. Le paquet est purement ESM et `externalizeDepsPlugin()` le laisse hors du bundle,
donc le build CommonJS fait un `require()` dessus et Node renvoie l'objet de module
`{ default: fn }` au lieu de la fonction. L'app plantait au démarrage avec
« contextMenu is not a function », avant même d'afficher une fenêtre.

Livré signé et notarisé en 1.4.0, 1.4.1 et 1.4.2. Découvert par Florian en ouvrant l'app.

**Pourquoi ça n'a pas été vu.** La vérification se limitait au typecheck et aux tests
unitaires. Ni l'un ni l'autre ne charge le main process : TypeScript valide l'import au
niveau des types, et les tests ne tournent que sur le renderer. Aucune des trois
livraisons n'avait été lancée. Le fait de ne pas pouvoir lancer l'app sans toucher aux
données réelles de Florian avait été accepté comme une fatalité au lieu d'être résolu.

**Règles.**

1. Ne jamais livrer un build sans avoir lancé l'application. Le typecheck et les tests
   unitaires ne sont pas une preuve de démarrage.
2. `scripts/smoke-test.sh` lance l'app sur un userData jetable (variable
   `UNICHAT_USER_DATA`) et vérifie qu'elle survit 15 secondes. Il est branché dans
   `build:mac`, donc un main process cassé ne peut plus être packagé.
3. Quand une vérification semble impossible parce qu'elle risque d'abîmer les données de
   l'utilisateur, rendre la vérification possible (ici : une variable d'environnement)
   plutôt que s'en passer.
4. Pour tout paquet ESM laissé externe par `externalizeDepsPlugin`, accepter les deux
   formes d'import (`typeof x === 'function' ? x : x.default`).
