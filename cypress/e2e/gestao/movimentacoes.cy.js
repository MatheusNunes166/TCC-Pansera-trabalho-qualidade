import { abrirAba, simularMovimentacoes, ultimaConsultaDeve, ROTA_MOVIMENTOS } from '../../support/consultas'

const consulta = (rotulo) => cy.get(`[aria-label="${rotulo}"]`)
const linhas = () => cy.get('tbody tr')

describe('Gestão — histórico de movimentações', () => {
  describe('Com movimentações', () => {
    beforeEach(() => {
      cy.fixture('movimentacoes').then((base) => {
        simularMovimentacoes(base)
        abrirAba('Movimentações')
        cy.wait('@movimentos')
      })
    })

    it('lista as movimentações com data, produto, ação, quantidade e origem', () => {
      cy.contains('h2', 'Histórico de Movimentações').should('be.visible')
      linhas().first().should('contain', 'Arroz 5kg').and('contain', '↓ Retirada').and('contain', '5').and('contain', 'Estoque')
      linhas().first().invoke('text').should('match', /\d{2}\/\d{2}\/\d{4}/)
      cy.contains('tr', 'Feijão 1kg').should('contain', '↑ Entrada')
      cy.contains('tr', 'Esponja').should('contain', '🗑 Remoção')
      cy.contains('tr', 'Detergente').should('contain', '✎ Edição')
    })

    it('mostra o responsável e identifica movimentações vindas do sistema de pedidos', () => {
      cy.contains('tr', 'Arroz 5kg').first().should('contain', 'Ana Lima')
      cy.contains('tr', 'Café 500g').should('contain', 'Pedido').and('contain', 'Sistema de Pedidos')
    })

    it('mostra o total de registros', () => {
      cy.contains('6 registros').should('be.visible')
    })

    it('mostra "—" na quantidade de uma edição', () => {
      cy.contains('tr', 'Detergente').find('td').eq(3).should('have.text', '—')
    })

    it('expande e oculta os detalhes de uma edição', () => {
      cy.contains('tr', 'Detergente').contains('button', 'Detalhes').click()
      cy.contains('li', 'Nome:').should('contain', 'Detergente').and('contain', 'Detergente Neutro')
      cy.contains('li', 'Quantidade:').should('contain', '10').and('contain', '12')
      cy.contains('tr', 'Detergente').contains('button', 'Ocultar').click()
      cy.contains('li', 'Nome:').should('not.exist')
    })

    it('filtra por tipo de ação no servidor', () => {
      consulta('Tipo de ação').select('Retirada')
      ultimaConsultaDeve('movimentos', 'tipo=saida')
      linhas().should('have.length', 2)
      cy.contains('tr', 'Feijão 1kg').should('not.exist')
    })

    it('lista os usuários no filtro e filtra pelo escolhido', () => {
      consulta('Usuário').find('option').then(($o) => {
        expect([...$o].map((o) => o.textContent)).to.deep.eq(['Todos os usuários', 'Ana Lima', 'Bruno Reis'])
      })
      consulta('Usuário').select('Bruno Reis')
      ultimaConsultaDeve('movimentos', 'user=Bruno')
      linhas().should('have.length', 2)
    })

    it('busca por nome do produto depois que o usuário para de digitar', () => {
      consulta('Produto').type('arroz')
      ultimaConsultaDeve('movimentos', 'q=arroz')
      linhas().should('have.length', 2)
    })

    it('filtra por período', () => {
      consulta('Data inicial').type('2026-11-01')
      ultimaConsultaDeve('movimentos', 'from=2026-11-01')
      consulta('Data final').type('2026-11-30')
      ultimaConsultaDeve('movimentos', 'to=2026-11-30')
    })

    it('avisa e não consulta quando a data final é anterior à inicial', () => {
      consulta('Data inicial').type('2026-11-10')
      cy.wait('@movimentos')
      cy.intercept({ method: 'GET', url: ROTA_MOVIMENTOS }, cy.spy().as('semConsulta'))
      consulta('Data final').type('2026-11-01')
      cy.contains('A data final deve ser igual ou posterior à data inicial.').should('be.visible')
      cy.get('@semConsulta').should('not.have.been.called')
    })

    it('mostra aviso quando o filtro não encontra nada e "Limpar" restaura a lista', () => {
      consulta('Produto').type('inexistente')
      cy.contains('Nenhuma movimentação encontrada para esses filtros.').should('be.visible')
      cy.contains('button', 'Limpar').click()
      consulta('Produto').should('have.value', '')
      linhas().should('have.length', 6)
    })

    it('mantém "Limpar" desabilitado enquanto não há filtros', () => {
      cy.contains('button', 'Limpar').should('be.disabled')
      consulta('Tipo de ação').select('Entrada')
      cy.contains('button', 'Limpar').should('be.enabled')
    })

    it('consulta de novo ao clicar em "Atualizar"', () => {
      cy.contains('button', 'Atualizar').click()
      cy.wait('@movimentos')
    })
  })

  it('mostra o estado vazio quando não há movimentações', () => {
    simularMovimentacoes([])
    abrirAba('Movimentações')
    cy.contains('Nenhuma movimentação registrada ainda.').should('be.visible')
  })

  it('mostra a mensagem da API quando o histórico não carrega', () => {
    cy.intercept('GET', '**/api/movements/users', { statusCode: 200, body: [] })
    cy.intercept({ method: 'GET', url: ROTA_MOVIMENTOS }, { statusCode: 500, body: { message: 'Falha no servidor.' } })
    abrirAba('Movimentações')
    cy.contains('Falha no servidor.').should('be.visible')
  })

  it('pagina o histórico e pede a página seguinte ao servidor', () => {
    cy.fixture('movimentacoes').then((base) => {
      cy.intercept('GET', '**/api/movements/users', { statusCode: 200, body: [] })
      cy.intercept({ method: 'GET', url: ROTA_MOVIMENTOS }, { statusCode: 200, body: { items: base.slice(0, 3), total: 60 } }).as('movimentos')
      abrirAba('Movimentações')
      cy.wait('@movimentos')
      cy.contains(/Página 1 de \d+/).should('be.visible')
      cy.contains('60 registros').should('be.visible')
      cy.contains('button', 'Próxima ›').click()
      ultimaConsultaDeve('movimentos', 'page=2')
      cy.contains(/Página 2 de \d+/).should('be.visible')
    })
  })

  it('operador também consulta o histórico', () => {
    cy.fixture('movimentacoes').then((base) => {
      simularMovimentacoes(base)
      abrirAba('Movimentações', { papel: 'user' })
      cy.wait('@movimentos')
      cy.contains('tr', 'Arroz 5kg').should('exist')
    })
  })
})
