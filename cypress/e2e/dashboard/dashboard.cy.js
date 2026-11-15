// Testes da área autenticada com backend simulado (cy.intercept): não dependem do banco.
describe('Dashboard (backend simulado)', () => {
  it('abre o dashboard com a sessão e lista a visão geral dos produtos', () => {
    cy.visitAutenticado('/dashboard')
    cy.location('pathname').should('eq', '/dashboard')
    cy.contains('h2', 'Visão geral dos produtos').should('be.visible')
    cy.contains('Total de Produtos').should('be.visible')
  })

  it('encerra a sessão e volta ao login pelo menu do perfil', () => {
    cy.visitAutenticado('/dashboard')
    cy.get('button[title="Perfil"]').click()
    cy.contains('button', 'Sair da conta').click()
    cy.location('pathname').should('eq', '/')
    cy.window().its('sessionStorage').invoke('getItem', 'token').should('be.null')
  })

  it('volta ao login com aviso quando a API responde 401 (sessão expirada)', () => {
    cy.stubApiPadrao()
    cy.intercept('GET', '**/api/products', { statusCode: 401, body: { message: 'Sessão encerrada. Entre novamente.' } })
    cy.visitAutenticado('/dashboard', {}, { stubs: false })
    cy.location('pathname').should('eq', '/')
    cy.contains('Sessão encerrada. Entre novamente.').should('be.visible')
  })
})
