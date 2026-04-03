// __APP_VERSION__ est injecté à la compilation par Vite (electron.vite.config.ts → define).
// Le typeof évite un ReferenceError dans l'environnement de test où le define n'est pas appliqué.
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
