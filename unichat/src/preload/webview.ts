// Preload de session : chargé dans chaque page des comptes (webviews et popups de
// connexion), avant les scripts de la page. Voir webauthnGuard.ts.
import { contextBridge } from 'electron'
import { disableWebAuthn } from './webauthnGuard'

contextBridge.executeInMainWorld({ func: disableWebAuthn })
