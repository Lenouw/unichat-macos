// Injecte les constantes build-time pour l'environnement de test
;(globalThis as unknown as Record<string, unknown>).__APP_VERSION__ = 'test'
