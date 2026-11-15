// ── Comandos customizados ─────────────────────────────────────────────────────
// A sessão do StockFlow fica em sessionStorage ('token' e 'user'), ver src/context/AuthContext.jsx.

/** Faz login preenchendo o formulário da tela inicial (fluxo real de UI). */
Cypress.Commands.add('login', (identifier, senha) => {
  cy.visit('/')
  cy.get('input[placeholder*="CNPJ, CPF ou e-mail"]').type(identifier)
  cy.get('input[placeholder="••••••••"]').type(senha, { log: false })
  cy.contains('button', 'ENTRAR').click()
})

/**
 * Login rápido via API real, com cache de sessão (cy.session).
 * Requer `userIdentifier` e `userPassword` em cypress.env.json e o backend no ar.
 */
Cypress.Commands.add('loginViaApi', () => {
  cy.env(['userIdentifier', 'userPassword']).then(({ userIdentifier, userPassword }) => {
    cy.session(
      ['api', userIdentifier],
      () => {
        cy.request('POST', `${Cypress.expose('apiUrl')}/api/auth/login`, {
          identifier: userIdentifier,
          senha: userPassword,
        }).then(({ body }) => {
          cy.visit('/', { onBeforeLoad: (win) => salvarSessao(win, body) })
        })
      },
      {
        validate() {
          cy.window().its('sessionStorage').invoke('getItem', 'token').should('be.a', 'string')
        },
      },
    )
  })
})

/** Respostas padrão (fixtures) para as rotas /api carregadas pelo dashboard. Nada toca o banco. */
Cypress.Commands.add('stubApiPadrao', () => {
  cy.intercept('GET', '**/api/profile', { statusCode: 200, body: { conta_principal: true } })
  cy.intercept('GET', '**/api/products', { fixture: 'produtos.json' })
})

/**
 * Abre uma página já autenticada com uma sessão FALSA (sem backend), usando as respostas de
 * `stubApiPadrao`. Para variar uma resposta, chame `cy.stubApiPadrao()` e depois declare seu
 * cy.intercept (o último declarado vence) e use `{ stubs: false }` aqui para não sobrescrevê-lo.
 */
Cypress.Commands.add('visitAutenticado', (caminho = '/dashboard', overrides = {}, { stubs = true } = {}) => {
  if (stubs) cy.stubApiPadrao()
  cy.fixture('login-sucesso').then((usuario) => {
    cy.visit(caminho, { onBeforeLoad: (win) => salvarSessao(win, { ...usuario, ...overrides }) })
  })
})

function salvarSessao(win, { token, nome, role, id, avatar_url }) {
  win.sessionStorage.setItem('token', token)
  win.sessionStorage.setItem(
    'user',
    JSON.stringify({ nome, role: role || 'admin', id, avatarUrl: avatar_url || null }),
  )
}
