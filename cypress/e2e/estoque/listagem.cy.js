import { abrirEstoque } from '../../support/estoque'

const valorDaMetrica = (rotulo) => cy.contains('div.text-xs', rotulo).prev()
const primeiraLinha = () => cy.get('tbody tr').first()

describe('Estoque — listagem de produtos', () => {
  describe('Tela inicial', () => {
    it('calcula as métricas do estoque', () => {
      abrirEstoque()
      valorDaMetrica('Total de Produtos').should('have.text', '5')
      valorDaMetrica('Em Estoque').should('have.text', '4')
      valorDaMetrica('Estoque Baixo').should('have.text', '1')
      valorDaMetrica('Sem Estoque').should('have.text', '1')
    })

    it('lista os produtos na visão geral', () => {
      abrirEstoque()
      cy.contains('h2', 'Visão geral dos produtos').should('be.visible')
      ;['Arroz 5kg', 'Feijão 1kg', 'Café 500g', 'Detergente', 'Esponja'].forEach((nome) => {
        cy.contains('td', nome).should('exist')
      })
    })

    it('mostra o estado vazio quando não há produtos', () => {
      abrirEstoque({ produtos: [] })
      cy.contains('Nenhum produto cadastrado ainda.').should('be.visible')
      valorDaMetrica('Total de Produtos').should('have.text', '—')
    })

    it('ordena por nome: crescente, decrescente e sem ordem', () => {
      abrirEstoque()
      cy.contains('th', 'Nome').as('cabecalho').find('button').click()
      cy.get('@cabecalho').should('have.attr', 'aria-sort', 'ascending')
      primeiraLinha().should('contain', 'Arroz 5kg')
      cy.get('@cabecalho').find('button').click()
      cy.get('@cabecalho').should('have.attr', 'aria-sort', 'descending')
      primeiraLinha().should('contain', 'Feijão 1kg')
      cy.get('@cabecalho').find('button').click()
      cy.get('@cabecalho').should('have.attr', 'aria-sort', 'none')
    })

    it('ordena por quantidade como número', () => {
      abrirEstoque()
      cy.contains('th', 'Qtd.').find('button').click()
      primeiraLinha().should('contain', 'Café 500g')
      cy.contains('th', 'Qtd.').find('button').click()
      primeiraLinha().should('contain', 'Esponja')
    })

    it('abre a lista de esgotados pelo cartão "Sem Estoque"', () => {
      abrirEstoque()
      cy.contains('button', 'Sem Estoque').click()
      cy.contains('h2', 'Produtos Esgotados').should('be.visible')
      cy.contains('td', 'Café 500g').should('exist')
      cy.contains('td', 'Arroz 5kg').should('not.exist')
    })

    it('mostra mensagem quando nenhum produto está esgotado', () => {
      abrirEstoque({ produtos: [{ id: 1, nome: 'Arroz 5kg', quantidade: 25, unidade: 'KG', categoria: 'Alimentos' }] })
      cy.contains('button', 'Sem Estoque').click()
      cy.contains('Nenhum produto esgotado no momento.').should('be.visible')
    })

    it('vai para a aba Produtos pelo link "Gerenciar"', () => {
      abrirEstoque()
      cy.contains('button', 'Gerenciar').click()
      cy.get('input[placeholder="Buscar produto por nome…"]').should('be.visible')
    })
  })

  describe('Aba Produtos', () => {
    beforeEach(() => abrirEstoque({ aba: 'Produtos' }))

    it('agrupa os produtos por categoria, com "Sem Categoria" por último', () => {
      cy.contains('tr', 'Alimentos').should('contain', '3 produtos')
      cy.contains('tr', 'Limpeza').should('contain', '1 produto')
      cy.contains('tr', 'Sem Categoria').should('contain', '1 produto')
      cy.get('tbody tr').last().should('contain', 'Esponja')
    })

    it('filtra pela busca, sem diferenciar maiúsculas', () => {
      cy.get('input[placeholder="Buscar produto por nome…"]').type('ARROZ')
      cy.contains('td', 'Arroz 5kg').should('exist')
      cy.contains('td', 'Feijão 1kg').should('not.exist')
      cy.contains('tr', 'Limpeza').should('not.exist')
    })

    it('avisa quando a busca não encontra nada', () => {
      cy.get('input[placeholder="Buscar produto por nome…"]').type('xyz')
      cy.contains('Nenhum produto encontrado para "xyz".').should('be.visible')
    })

    it('limpa a busca pelo botão ✕', () => {
      cy.get('input[placeholder="Buscar produto por nome…"]').type('arroz')
      cy.contains('button', '✕').click()
      cy.get('input[placeholder="Buscar produto por nome…"]').should('have.value', '')
      cy.contains('td', 'Feijão 1kg').should('exist')
    })

    it('desabilita "Retirar" apenas para produto sem estoque', () => {
      cy.contains('tr', 'Café 500g').contains('button', 'Retirar').should('be.disabled')
      cy.contains('tr', 'Arroz 5kg').contains('button', 'Retirar').should('be.enabled')
    })

    it('troca o layout para Grade e lembra a escolha', () => {
      cy.contains('button', 'Lista').click()
      cy.contains('button', 'Grade').click()
      cy.window().its('localStorage').invoke('getItem', 'sf_layout').should('eq', 'grade')
      cy.reload()
      cy.get('button[title="Produtos"]').click()
      cy.contains('button', 'Grade').should('be.visible')
      cy.get('table').should('not.exist')
    })
  })
})
