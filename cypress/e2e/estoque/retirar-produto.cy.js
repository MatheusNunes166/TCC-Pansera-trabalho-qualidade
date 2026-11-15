import { abrirEstoque } from '../../support/estoque'

const abrirRetirada = (produto) => cy.contains('tr', produto).contains('button', 'Retirar').click()
const quantidade = () => cy.get('input[inputmode="decimal"]')
const confirmar = () => cy.contains('button', 'Confirmar Retirada').click()

describe('Estoque — retirada de produto', () => {
  beforeEach(() => abrirEstoque({ aba: 'Produtos' }))

  it('mostra o produto e a quantidade disponível', () => {
    abrirRetirada('Arroz 5kg')
    cy.contains('h2', 'Retirar do Estoque').should('be.visible')
    cy.contains('Disponível:').should('contain', '25 KG')
    cy.get('input[placeholder="Máx: 25"]').should('be.visible')
  })

  it('exige uma quantidade maior que zero', () => {
    cy.intercept('POST', '**/api/products/*/withdraw', cy.spy().as('api'))
    abrirRetirada('Arroz 5kg')
    confirmar()
    cy.contains('Informe uma quantidade válida maior que zero.').should('be.visible')
    quantidade().type('0')
    confirmar()
    cy.contains('Informe uma quantidade válida maior que zero.').should('be.visible')
    cy.get('@api').should('not.have.been.called')
  })

  it('não permite retirar mais do que o estoque disponível', () => {
    cy.intercept('POST', '**/api/products/*/withdraw', cy.spy().as('api'))
    abrirRetirada('Arroz 5kg')
    quantidade().type('30')
    confirmar()
    cy.contains('Quantidade maior que o estoque disponível (25 KG).').should('be.visible')
    cy.get('@api').should('not.have.been.called')
  })

  it('aceita somente números (com ponto decimal)', () => {
    abrirRetirada('Arroz 5kg')
    quantidade().type('abc').should('have.value', '')
    quantidade().type('2.5').should('have.value', '2.5')
  })

  it('registra a retirada e atualiza a quantidade na lista', () => {
    abrirRetirada('Arroz 5kg')
    quantidade().type('5')
    confirmar()
    cy.wait('@retirarProduto').then(({ request }) => {
      expect(request.url).to.match(/\/api\/products\/1\/withdraw$/)
      expect(request.body).to.deep.equal({ quantidade: 5 })
    })
    cy.contains('h2', 'Retirar do Estoque').should('not.exist')
    cy.contains('tr', 'Arroz 5kg').find('td').eq(1).should('have.text', '20')
  })

  it('aceita retirada fracionada', () => {
    abrirRetirada('Arroz 5kg')
    quantidade().type('2.5')
    confirmar()
    cy.wait('@retirarProduto').its('request.body').should('deep.equal', { quantidade: 2.5 })
    cy.contains('tr', 'Arroz 5kg').find('td').eq(1).should('have.text', '22.5')
  })

  it('ao retirar todo o estoque, o produto fica esgotado e o botão é desabilitado', () => {
    abrirRetirada('Feijão 1kg')
    quantidade().type('3')
    confirmar()
    cy.wait('@retirarProduto')
    cy.contains('tr', 'Feijão 1kg').contains('button', 'Retirar').should('be.disabled')
    cy.get('button[title="Início"]').click()
    cy.contains('div.text-xs', 'Sem Estoque').prev().should('have.text', '2')
  })

  it('mantém o modal aberto e mostra a mensagem quando a API recusa', () => {
    cy.intercept({ method: 'POST', url: /\/withdraw$/ }, { statusCode: 400, body: { message: 'Estoque insuficiente.' } }).as('recusa')
    abrirRetirada('Arroz 5kg')
    quantidade().type('5')
    confirmar()
    cy.wait('@recusa')
    cy.contains('Estoque insuficiente.').should('be.visible')
    cy.contains('h2', 'Retirar do Estoque').should('be.visible')
  })

  it('fecha com Cancelar, Esc ou clique fora do modal, sem registrar nada', () => {
    cy.intercept('POST', '**/api/products/*/withdraw', cy.spy().as('api'))
    abrirRetirada('Arroz 5kg')
    cy.contains('button', 'Cancelar').click()
    cy.contains('h2', 'Retirar do Estoque').should('not.exist')

    abrirRetirada('Arroz 5kg')
    cy.get('body').type('{esc}')
    cy.contains('h2', 'Retirar do Estoque').should('not.exist')

    abrirRetirada('Arroz 5kg')
    cy.get('div.fixed.inset-0').click('topLeft')
    cy.contains('h2', 'Retirar do Estoque').should('not.exist')
    cy.get('@api').should('not.have.been.called')
  })

  it('permite que o operador (sem cargo de gestão) registre retiradas', () => {
    abrirEstoque({ papel: 'user', aba: 'Produtos' })
    abrirRetirada('Arroz 5kg')
    quantidade().type('1')
    confirmar()
    cy.wait('@retirarProduto').its('response.statusCode').should('eq', 200)
  })
})
