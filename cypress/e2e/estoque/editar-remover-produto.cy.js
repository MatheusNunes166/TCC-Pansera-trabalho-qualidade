import { abrirEstoque } from '../../support/estoque'

const campo = (rotulo) => cy.contains('label', rotulo).parent().find('input, select')
const abrirEdicao = (produto) => cy.contains('tr', produto).contains('button', 'Editar').click()
const salvar = () => cy.contains('button', 'Salvar').click()

describe('Estoque — editar e remover produto', () => {
  describe('Permissões por cargo', () => {
    it('administrador vê o botão "Editar"', () => {
      abrirEstoque({ papel: 'admin', aba: 'Produtos' })
      cy.contains('tr', 'Arroz 5kg').contains('button', 'Editar').should('be.visible')
    })

    it('sócio também vê o botão "Editar"', () => {
      abrirEstoque({ papel: 'socio', aba: 'Produtos' })
      cy.contains('tr', 'Arroz 5kg').contains('button', 'Editar').should('be.visible')
    })

    it('operador não vê o botão "Editar", mas continua vendo "Retirar"', () => {
      abrirEstoque({ papel: 'user', aba: 'Produtos' })
      cy.contains('button', 'Editar').should('not.exist')
      cy.contains('tr', 'Arroz 5kg').contains('button', 'Retirar').should('be.visible')
    })
  })

  describe('Edição', () => {
    beforeEach(() => abrirEstoque({ aba: 'Produtos' }))

    it('abre o modal com os dados atuais do produto', () => {
      abrirEdicao('Arroz 5kg')
      cy.contains('h2', 'Editar Produto').should('be.visible')
      campo('Nome do produto').should('have.value', 'Arroz 5kg')
      campo('Quantidade').should('have.value', '25')
      campo('Unidade').should('have.value', 'KG')
      campo('Categoria').should('have.value', 'Alimentos')
      campo('Fornecedor').should('have.value', 'Distribuidora Sul')
    })

    // Observação: o cadastro oferece 10 unidades (UN, CX, PCT, KG, G, T, L, ML, M, CM), mas a edição só 4.
    it('oferece as unidades UN, KG, L e CX na edição', () => {
      abrirEdicao('Arroz 5kg')
      campo('Unidade').find('option').then(($opcoes) => {
        expect([...$opcoes].map((o) => o.value)).to.deep.eq(['UN', 'KG', 'L', 'CX'])
      })
    })

    it('exige o nome do produto', () => {
      cy.intercept({ method: 'PUT', url: /\/api\/products\/\d+$/ }, cy.spy().as('api'))
      abrirEdicao('Arroz 5kg')
      campo('Nome do produto').clear()
      salvar()
      cy.contains('Nome é obrigatório.').should('be.visible')
      cy.get('@api').should('not.have.been.called')
    })

    it('exige a quantidade', () => {
      abrirEdicao('Arroz 5kg')
      campo('Quantidade').clear()
      salvar()
      cy.contains('Quantidade é obrigatória.').should('be.visible')
    })

    it('permite zerar a quantidade (diferente do cadastro, que exige maior que zero)', () => {
      abrirEdicao('Arroz 5kg')
      campo('Quantidade').clear().type('0')
      salvar()
      cy.wait('@editarProduto').its('request.body.quantidade').should('eq', 0)
      cy.contains('tr', 'Arroz 5kg').find('td').eq(1).should('have.text', '0')
    })

    it('salva as alterações e atualiza a lista', () => {
      abrirEdicao('Arroz 5kg')
      campo('Nome do produto').clear().type('Arroz Integral 5kg')
      campo('Quantidade').clear().type('18')
      campo('Unidade').select('CX')
      campo('Categoria').clear().type('Grãos')
      campo('Fornecedor').clear()
      salvar()
      cy.wait('@editarProduto').then(({ request }) => {
        expect(request.url).to.match(/\/api\/products\/1$/)
        expect(request.body).to.deep.equal({
          nome: 'Arroz Integral 5kg',
          quantidade: 18,
          unidade: 'CX',
          categoria: 'Grãos',
          fornecedor: null,
        })
      })
      cy.contains('h2', 'Editar Produto').should('not.exist')
      cy.contains('td', 'Arroz Integral 5kg').should('be.visible')
      cy.contains('tr', 'Grãos').should('contain', '1 produto')
    })

    it('mantém o modal aberto e mostra a mensagem quando a API recusa', () => {
      cy.intercept({ method: 'PUT', url: /\/api\/products\/\d+$/ }, { statusCode: 400, body: { message: 'Nome já em uso.' } }).as('recusa')
      abrirEdicao('Arroz 5kg')
      campo('Nome do produto').clear().type('Feijão 1kg')
      salvar()
      cy.wait('@recusa')
      cy.contains('Nome já em uso.').should('be.visible')
      cy.contains('h2', 'Editar Produto').should('be.visible')
    })

    it('fecha com Cancelar ou Esc sem salvar', () => {
      cy.intercept({ method: 'PUT', url: /\/api\/products\/\d+$/ }, cy.spy().as('api'))
      abrirEdicao('Arroz 5kg')
      campo('Nome do produto').clear().type('Outro nome')
      cy.contains('button', 'Cancelar').click()
      cy.contains('h2', 'Editar Produto').should('not.exist')
      abrirEdicao('Arroz 5kg')
      cy.get('body').type('{esc}')
      cy.contains('h2', 'Editar Produto').should('not.exist')
      cy.contains('td', 'Arroz 5kg').should('be.visible')
      cy.get('@api').should('not.have.been.called')
    })
  })

  describe('Remoção', () => {
    beforeEach(() => abrirEstoque({ aba: 'Produtos' }))

    it('pede confirmação antes de remover', () => {
      abrirEdicao('Detergente')
      cy.contains('button', 'Remover produto').click()
      cy.contains('Remover Detergente? Essa ação não pode ser desfeita.').should('be.visible')
      cy.contains('button', 'Sim, remover').should('be.visible')
    })

    it('cancelar a confirmação não remove o produto', () => {
      cy.intercept({ method: 'DELETE', url: /\/api\/products\/\d+$/ }, cy.spy().as('api'))
      abrirEdicao('Detergente')
      cy.contains('button', 'Remover produto').click()
      cy.get('div.border-red-200').contains('button', 'Cancelar').click()
      cy.contains('button', 'Remover produto').should('be.visible')
      cy.get('@api').should('not.have.been.called')
    })

    it('remove o produto e ele some da lista', () => {
      abrirEdicao('Detergente')
      cy.contains('button', 'Remover produto').click()
      cy.contains('button', 'Sim, remover').click()
      cy.wait('@removerProduto').its('request.url').should('match', /\/api\/products\/4$/)
      cy.contains('h2', 'Editar Produto').should('not.exist')
      cy.contains('td', 'Detergente').should('not.exist')
      cy.contains('tr', 'Limpeza').should('not.exist')
    })

    it('mostra a mensagem quando a API recusa a remoção (ex.: sem permissão)', () => {
      cy.intercept({ method: 'DELETE', url: /\/api\/products\/\d+$/ }, { statusCode: 403, body: { message: 'Acesso negado.' } }).as('recusa')
      abrirEdicao('Detergente')
      cy.contains('button', 'Remover produto').click()
      cy.contains('button', 'Sim, remover').click()
      cy.wait('@recusa')
      cy.contains('Acesso negado.').should('be.visible')
      cy.contains('td', 'Detergente').should('exist')
    })
  })
})
