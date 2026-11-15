describe('Login', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('exibe o formulário de login', () => {
    cy.contains('h1', 'StockFlow').should('be.visible')
    cy.get('input[placeholder*="CNPJ, CPF ou e-mail"]').should('be.visible')
    cy.get('input[placeholder="••••••••"]').should('be.visible')
    cy.contains('button', 'ENTRAR').should('be.enabled')
  })

  it('exige o preenchimento dos campos', () => {
    cy.contains('button', 'ENTRAR').click()
    cy.contains('Preencha todos os campos.').should('be.visible')
  })

  it('formata CPF enquanto o usuário digita', () => {
    cy.get('input[placeholder*="CNPJ, CPF ou e-mail"]').type('12345678901').should('have.value', '123.456.789-01')
  })

  it('não formata quando o identificador é um e-mail', () => {
    cy.get('input[placeholder*="CNPJ, CPF ou e-mail"]').type('alguem@exemplo.com').should('have.value', 'alguem@exemplo.com')
  })

  it('alterna a visibilidade da senha', () => {
    cy.get('input[placeholder="••••••••"]').type('segredo').should('have.attr', 'type', 'password')
    cy.contains('button', '👁️').click()
    cy.get('input[placeholder="••••••••"]').should('have.attr', 'type', 'text')
  })

  it('mostra erro com credenciais inválidas', () => {
    cy.intercept('POST', '**/api/auth/login', { statusCode: 401, body: { message: 'Usuário ou senha inválidos.' } }).as('login')
    cy.login('naoexiste@exemplo.com', 'senhaerrada')
    cy.wait('@login')
    cy.contains('Usuário ou senha inválidos.').should('be.visible')
    cy.location('pathname').should('eq', '/')
  })

  it('mostra a mensagem de erro devolvida pela API (conta desativada)', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 403,
      body: { message: 'Conta desativada. Entre em contato com o administrador.' },
    }).as('login')
    cy.login('inativo@exemplo.com', 'qualquer')
    cy.wait('@login')
    cy.contains('Conta desativada. Entre em contato com o administrador.').should('be.visible')
    cy.contains('button', 'ENTRAR').should('be.enabled')
  })

  it('entra no dashboard com credenciais válidas (backend simulado)', () => {
    cy.fixture('login-sucesso').then((usuario) => {
      cy.intercept('POST', '**/api/auth/login', { statusCode: 200, body: usuario }).as('login')
    })
    cy.stubApiPadrao()

    cy.login('usuario@exemplo.com', 'senha123')
    cy.wait('@login').its('request.body').should('deep.equal', { identifier: 'usuario@exemplo.com', senha: 'senha123' })
    cy.location('pathname').should('eq', '/dashboard')
    cy.window().its('sessionStorage').invoke('getItem', 'token').should('eq', 'token-falso-apenas-para-testes-e2e')
  })
})

// ── Backend real ──────────────────────────────────────────────────────────────
// Só roda quando userIdentifier/userPassword estão definidos em cypress.env.json
// e o backend está no ar. Use SEMPRE um usuário de teste. Sem credenciais, o teste fica "pending".
describe('Login (backend real)', () => {
  beforeEach(function () {
    cy.env(['userIdentifier', 'userPassword']).then(({ userIdentifier, userPassword }) => {
      if (!userIdentifier || !userPassword) this.skip()
    })
  })

  it('autentica o usuário de teste pela interface', () => {
    cy.env(['userIdentifier', 'userPassword']).then(({ userIdentifier, userPassword }) => {
      cy.intercept('POST', '**/api/auth/login').as('login')
      cy.login(userIdentifier, userPassword)
      cy.wait('@login').its('response.statusCode').should('eq', 200)
      cy.location('pathname').should('eq', '/dashboard')
    })
  })

  it('reutiliza a sessão criada via API', () => {
    cy.loginViaApi()
    cy.visit('/dashboard')
    cy.location('pathname').should('eq', '/dashboard')
  })
})
