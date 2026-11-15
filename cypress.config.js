import { defineConfig } from 'cypress'

// O frontend (TCC Claude/frontend) roda com HTTPS (plugin basic-ssl do Vite) e faz proxy de /api -> backend Node (porta 3001).
// Cypress 16: valores NÃO sensíveis ficam em `expose` (Cypress.expose) e os sensíveis em `env` (cy.env).
// As credenciais vêm do arquivo `cypress.env.json` (não versionado; copie de `cypress.env.example.json`)
// ou de variáveis CYPRESS_userIdentifier / CYPRESS_userPassword.
export default defineConfig({
  e2e: {
    baseUrl: 'https://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx}',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    viewportWidth: 1366,
    viewportHeight: 768,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    retries: { runMode: 1, openMode: 0 },
    expose: {
      // URL direta do backend Node (usada por cy.request nos comandos de API)
      apiUrl: 'http://localhost:3001',
    },
    env: {
      // Credenciais de um usuário DE TESTE já existente no banco. Vazias por padrão:
      // os testes que dependem do backend real ficam "pending" enquanto não forem definidas.
      userIdentifier: '',
      userPassword: '',
    },
  },
})
