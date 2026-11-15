describe('Navegação e rotas protegidas', () => {
  it('redireciona /dashboard para o login quando não há sessão', () => {
    cy.visit('/dashboard')
    cy.location('pathname').should('eq', '/')
    cy.contains('button', 'ENTRAR').should('be.visible')
  })

  it('vai para o cadastro pelo link "Cadastrar-se"', () => {
    cy.visit('/')
    cy.contains('a', 'Cadastrar-se').click()
    cy.location('pathname').should('eq', '/register')
    cy.contains('h1', 'Criar conta').should('be.visible')
  })

  it('vai para a recuperação de senha pelo link "Esqueci a senha"', () => {
    cy.visit('/')
    cy.contains('a', 'Esqueci a senha').click()
    cy.location('pathname').should('eq', '/forgot-password')
    cy.contains('h2', 'Recuperar acesso').should('be.visible')
  })

  it('mostra a mensagem de sucesso após o cadastro', () => {
    cy.visit('/?success=cadastro')
    cy.contains('Conta criada com sucesso! Faça seu login.').should('be.visible')
  })

  it('persiste o tema escuro entre recarregamentos', () => {
    cy.visit('/')
    cy.get('button[title="Modo escuro"]').click()
    cy.get('html').should('have.class', 'dark')
    cy.reload()
    cy.get('html').should('have.class', 'dark')
    cy.window().its('localStorage').invoke('getItem', 'theme').should('eq', 'dark')
  })
})
