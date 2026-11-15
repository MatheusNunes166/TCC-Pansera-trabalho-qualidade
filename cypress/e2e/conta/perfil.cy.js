// Menu do perfil (canto superior direito do dashboard). Backend simulado.
describe('Perfil do usuário', () => {
  const abrirMenu = () => cy.get('button[title="Perfil"]').click()

  beforeEach(() => {
    cy.visitAutenticado('/dashboard')
  })

  it('mostra o nome e o cargo do usuário logado', () => {
    cy.get('button[title="Perfil"]').should('contain', 'Usuário Teste').and('contain', 'Administrador')
  })

  it('abre o menu com as opções do perfil', () => {
    abrirMenu()
    cy.contains('button', 'Alterar foto').should('be.visible')
    cy.contains('button', 'Alterar nome').should('be.visible')
    cy.contains('button', 'Sair da conta').should('be.visible')
  })

  it('fecha o menu ao clicar fora dele', () => {
    abrirMenu()
    cy.contains('button', 'Alterar nome').should('be.visible')
    cy.contains('h2', 'Visão geral dos produtos').click()
    cy.contains('button', 'Alterar nome').should('not.exist')
  })

  it('altera o nome, salva na API e atualiza a sessão', () => {
    cy.intercept('PUT', '**/api/profile', { statusCode: 200, body: {} }).as('salvarPerfil')
    abrirMenu()
    cy.contains('button', 'Alterar nome').click()
    cy.get('input[placeholder="Novo nome"]').clear().type('Ana Paula{enter}')
    cy.wait('@salvarPerfil').its('request.body').should('deep.equal', { nome: 'Ana Paula' })
    cy.get('button[title="Perfil"]').should('contain', 'Ana Paula')
    cy.window().its('sessionStorage').invoke('getItem', 'user').then((u) => {
      expect(JSON.parse(u).nome).to.eq('Ana Paula')
    })
  })

  it('cancela a edição do nome sem chamar a API', () => {
    cy.intercept('PUT', '**/api/profile', cy.spy().as('api'))
    abrirMenu()
    cy.contains('button', 'Alterar nome').click()
    cy.get('input[placeholder="Novo nome"]').clear().type('Outro Nome')
    cy.contains('button', 'Cancelar').click()
    cy.get('input[placeholder="Novo nome"]').should('not.exist')
    cy.get('button[title="Perfil"]').should('contain', 'Usuário Teste')
    cy.get('@api').should('not.have.been.called')
  })

  it('não salva um nome vazio', () => {
    cy.intercept('PUT', '**/api/profile', cy.spy().as('api'))
    abrirMenu()
    cy.contains('button', 'Alterar nome').click()
    cy.get('input[placeholder="Novo nome"]').clear()
    cy.contains('button', 'Salvar').click()
    cy.get('@api').should('not.have.been.called')
    cy.get('button[title="Perfil"]').should('contain', 'Usuário Teste')
  })
})
