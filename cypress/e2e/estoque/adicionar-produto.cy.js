import { abrirEstoque } from '../../support/estoque'

// Dentro do modal, devolve o controle (input/select) que pertence ao rótulo informado.
const campo = (rotulo) => cy.contains('label', rotulo).parent().find('input, select, textarea')
const abrirModal = () => cy.contains('button', '+ Novo produto').click()
const abrirModoManual = () => {
  abrirModal()
  cy.contains('button', 'Manual').click()
  cy.contains('h2', 'Cadastro Manual').should('be.visible')
}
const salvar = () => cy.contains('button', 'Salvar').click()
const CHAVE = '35241234567890123456789012345678901234567890'

describe('Estoque — adicionar produto', () => {
  beforeEach(() => abrirEstoque({ aba: 'Produtos' }))

  describe('Seleção do modo', () => {
    it('oferece cadastro manual, câmera e chave de acesso', () => {
      abrirModal()
      cy.contains('h2', 'Adicionar Produto').should('be.visible')
      cy.contains('Como deseja adicionar o produto?').should('be.visible')
      cy.contains('button', 'Manual').should('be.visible')
      cy.contains('button', 'Câmera').should('be.visible')
      cy.contains('button', 'Digitar chave').should('be.visible')
    })

    it('volta para a seleção de modo pelo botão ◀', () => {
      abrirModoManual()
      cy.get('button[title="Voltar"]').click()
      cy.contains('Como deseja adicionar o produto?').should('be.visible')
    })

    it('fecha o modal pelo botão ✕', () => {
      abrirModal()
      cy.get('button[title="Fechar"]').click()
      cy.contains('h2', 'Adicionar Produto').should('not.exist')
    })
  })

  describe('Cadastro manual', () => {
    it('exige nome e quantidade e não chama a API', () => {
      cy.intercept('POST', '**/api/products', cy.spy().as('api'))
      abrirModoManual()
      salvar()
      cy.contains('Nome é obrigatório.').should('be.visible')
      cy.contains('Quantidade é obrigatória.').should('be.visible')
      cy.get('@api').should('not.have.been.called')
    })

    it('já vem com a unidade "UN" selecionada e lista as unidades disponíveis', () => {
      abrirModoManual()
      campo('Unidade').should('have.value', 'UN')
      campo('Unidade').find('option').then(($opcoes) => {
        expect([...$opcoes].map((o) => o.value)).to.deep.eq(['UN', 'CX', 'PCT', 'KG', 'G', 'T', 'L', 'ML', 'M', 'CM'])
      })
    })

    it('rejeita quantidade zero', () => {
      abrirModoManual()
      campo('Nome do produto').type('Leite')
      campo('Quantidade').type('0')
      salvar()
      cy.contains('Quantidade deve ser um número maior que zero.').should('be.visible')
    })

    it('aceita somente números (com ponto decimal) na quantidade', () => {
      abrirModoManual()
      campo('Quantidade').type('abc').should('have.value', '')
      campo('Quantidade').type('2.5').should('have.value', '2.5')
    })

    it('aceita somente dígitos no código de barras', () => {
      abrirModoManual()
      campo('Código de barras (EAN)').type('ab12cd34').should('have.value', '1234')
    })

    it('cadastra o produto e o mostra na lista', () => {
      abrirModoManual()
      campo('Nome do produto').type('Leite Integral')
      campo('Quantidade').type('12')
      campo('Unidade').select('CX')
      campo('Categoria').type('Bebidas')
      campo('Fornecedor').type('Laticínios Alfa')
      salvar()
      cy.wait('@criarProduto').its('request.body').should('deep.equal', {
        nome: 'Leite Integral',
        quantidade: 12,
        unidade: 'CX',
        categoria: 'Bebidas',
        fornecedor: 'Laticínios Alfa',
        codigo_barras: null,
      })
      cy.contains('h2', 'Cadastro Manual').should('not.exist')
      cy.contains('tr', 'Bebidas').should('contain', '1 produto')
      cy.contains('td', 'Leite Integral').should('be.visible')
    })

    it('mantém o modal aberto e mostra a mensagem quando a API recusa', () => {
      cy.intercept('POST', '**/api/products', { statusCode: 400, body: { message: 'Produto já cadastrado.' } }).as('recusa')
      abrirModoManual()
      campo('Nome do produto').type('Arroz 5kg')
      campo('Quantidade').type('1')
      salvar()
      cy.wait('@recusa')
      cy.contains('Produto já cadastrado.').should('be.visible')
      cy.contains('h2', 'Cadastro Manual').should('be.visible')
    })

    describe('Busca por código de barras (EAN)', () => {
      const EAN = '7891000100103'

      it('preenche nome, categoria e fornecedor com os dados encontrados', () => {
        cy.intercept('GET', `**/api/products/barcode/${EAN}`, {
          statusCode: 200,
          body: { nome: 'Leite UHT 1L', categoria: 'Bebidas', marca: 'Marca X', jaCadastrado: false },
        }).as('ean')
        abrirModoManual()
        campo('Código de barras (EAN)').type(`${EAN}{enter}`)
        cy.wait('@ean')
        campo('Nome do produto').should('have.value', 'Leite UHT 1L')
        campo('Categoria').should('have.value', 'Bebidas')
        campo('Fornecedor').should('have.value', 'Marca X')
      })

      it('avisa quando o produto não é encontrado nas bases', () => {
        cy.intercept('GET', `**/api/products/barcode/${EAN}`, { statusCode: 404, body: {} }).as('ean')
        abrirModoManual()
        campo('Código de barras (EAN)').type(`${EAN}{enter}`)
        cy.wait('@ean')
        cy.contains('Produto não encontrado nas bases de dados. Preencha manualmente.').should('be.visible')
      })

      it('avisa quando o produto já está no estoque', () => {
        cy.intercept('GET', `**/api/products/barcode/${EAN}`, {
          statusCode: 200,
          body: { nome: 'Arroz 5kg', jaCadastrado: true, produtoExistente: { nome: 'Arroz 5kg' } },
        }).as('ean')
        abrirModoManual()
        campo('Código de barras (EAN)').type(`${EAN}{enter}`)
        cy.wait('@ean')
        cy.contains('Este produto já está no seu estoque (Arroz 5kg).').should('be.visible')
      })
    })
  })

  describe('Importação por chave de acesso da NF-e', () => {
    const abrirChave = () => {
      abrirModal()
      cy.contains('button', 'Digitar chave').click()
      cy.contains('h2', 'Chave de Acesso').should('be.visible')
    }

    it('só habilita a consulta com 44 dígitos e mostra o contador', () => {
      abrirChave()
      cy.contains('button', 'Consultar NF-e').should('be.disabled')
      cy.contains('0/44 dígitos').should('be.visible')
      cy.get('textarea').type(CHAVE)
      cy.contains('44/44 dígitos').should('be.visible')
      cy.contains('button', 'Consultar NF-e').should('be.enabled')
    })

    it('lista os produtos da nota e os adiciona ao estoque ao confirmar', () => {
      cy.intercept('GET', `**/api/nfe/${CHAVE}`, {
        statusCode: 200,
        body: {
          produtos: [
            { nome: 'Macarrão 500g', quantidade: 20, unidade: 'PCT', peso_kg: 0.5 },
            { nome: 'Molho de Tomate', quantidade: 30, unidade: 'UN', peso_kg: 0.34 },
          ],
        },
      }).as('nfe')
      abrirChave()
      cy.get('textarea').type(CHAVE)
      cy.contains('button', 'Consultar NF-e').click()
      cy.wait('@nfe')
      cy.contains('Produtos encontrados na NF-e (2):').should('be.visible')
      cy.contains('Macarrão 500g').should('be.visible')
      cy.contains('button', 'Confirmar e Adicionar').click()
      cy.wait('@criarProduto')
      cy.wait('@criarProduto')
      cy.contains('td', 'Macarrão 500g').should('be.visible')
      cy.contains('td', 'Molho de Tomate').should('be.visible')
    })

    it('cancela a importação sem criar produtos', () => {
      cy.intercept('GET', `**/api/nfe/${CHAVE}`, {
        statusCode: 200,
        body: { produtos: [{ nome: 'Macarrão 500g', quantidade: 20, unidade: 'PCT' }] },
      }).as('nfe')
      cy.intercept('POST', '**/api/products', cy.spy().as('api'))
      abrirChave()
      cy.get('textarea').type(CHAVE)
      cy.contains('button', 'Consultar NF-e').click()
      cy.wait('@nfe')
      cy.contains('button', 'Cancelar').click()
      cy.contains('Produtos encontrados na NF-e').should('not.exist')
      cy.get('@api').should('not.have.been.called')
    })

    it('mostra a mensagem quando a NF-e não é encontrada', () => {
      cy.intercept('GET', `**/api/nfe/${CHAVE}`, { statusCode: 404, body: { message: 'NF-e não encontrada.' } }).as('nfe')
      abrirChave()
      cy.get('textarea').type(CHAVE)
      cy.contains('button', 'Consultar NF-e').click()
      cy.wait('@nfe')
      cy.contains('NF-e não encontrada.').should('be.visible')
    })

    it('trata 8 a 14 dígitos como código de barras e abre o cadastro manual', () => {
      cy.intercept('GET', '**/api/products/barcode/7891000100103', { statusCode: 404, body: {} })
      abrirChave()
      cy.get('textarea').type('7891000100103')
      cy.contains('button', 'Buscar produto').click()
      cy.contains('h2', 'Cadastro Manual').should('be.visible')
      cy.contains('label', 'Código de barras (EAN)').parent().find('input').should('have.value', '7891000100103')
    })
  })
})
