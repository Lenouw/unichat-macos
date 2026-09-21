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
