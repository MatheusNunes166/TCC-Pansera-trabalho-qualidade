import { abrirAba } from '../../support/consultas'

// Mesma regra do app: período de N dias terminando hoje (datas locais, AAAA-MM-DD).
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function intervalo(dias) {
  const fim = new Date()
  const ini = new Date()
  ini.setDate(fim.getDate() - (dias - 1))
  return { from: iso(ini), to: iso(fim) }
}

const ROTA_RELATORIO = /\/api\/reports(\?.*)?$/
// A última consulta ao relatório deve ter pedido exatamente o intervalo informado (com retentativa).
function ultimaConsultaFoi({ from, to }) {
  cy.get('@relatorio.all').should((chamadas) => {
    expect(chamadas.length).to.be.greaterThan(0)
    const p = new URL(chamadas[chamadas.length - 1].request.url).searchParams
    expect({ from: p.get('from'), to: p.get('to') }).to.deep.eq({ from, to })
  })
}
const valorDoCartao = (rotulo) => cy.contains('div.text-xs', rotulo).prev()

function abrirRelatorios(opcoes) {
  cy.fixture('relatorio').then((relatorio) => {
    cy.intercept({ method: 'GET', url: ROTA_RELATORIO }, { statusCode: 200, body: relatorio }).as('relatorio')
    abrirAba('Relatórios', opcoes)
  })
}

describe('Gestão — relatórios', () => {
  describe('Conteúdo', () => {
    beforeEach(() => {
      abrirRelatorios()
      cy.wait('@relatorio')
    })

    it('mostra os cartões de resumo do período', () => {
      valorDoCartao('Total de produtos').should('have.text', '5')
      valorDoCartao('Estoque baixo').should('have.text', '1')
      valorDoCartao('Esgotados').should('have.text', '1')
      valorDoCartao('Entradas no período').should('have.text', '50')
      valorDoCartao('Saídas no período').should('have.text', '12,5')
    })

    it('lista os 10 mais retirados', () => {
      cy.contains('h2', 'Top 10 mais retirados').parent().within(() => {
        cy.get('tbody tr').should('have.length', 2)
        cy.get('tbody tr').first().should('contain', '1').and('contain', 'Arroz 5kg').and('contain', '7,5')
      })
    })

    it('mostra o consumo por categoria', () => {
      cy.contains('h2', 'Consumo por categoria').parent().within(() => {
        cy.contains('tr', 'Alimentos').should('contain', '7,5')
        cy.contains('tr', 'Limpeza').should('contain', '5')
      })
    })

    it('mostra o giro de estoque e usa "—" para produto sem estoque', () => {
      cy.contains('h2', 'Giro de estoque por produto').parent().within(() => {
        cy.contains('tr', 'Arroz 5kg').should('contain', '25 KG').and('contain', '0,3')
        cy.contains('tr', 'Café 500g').should('contain', '0 PCT').and('contain', '—')
      })
    })
  })

  describe('Período', () => {
    it('consulta os últimos 30 dias por padrão', () => {
      abrirRelatorios()
      cy.wait('@relatorio')
      ultimaConsultaFoi(intervalo(30))
    })

    ;[7, 90].forEach((dias) => {
      it(`consulta os últimos ${dias} dias ao escolher "${dias} dias"`, () => {
        abrirRelatorios()
        cy.wait('@relatorio')
        cy.contains('button', `${dias} dias`).click()
        ultimaConsultaFoi(intervalo(dias))
      })
    })

    it('consulta o intervalo escolhido em "Personalizado"', () => {
      abrirRelatorios()
      cy.wait('@relatorio')
      cy.contains('button', 'Personalizado').click()
      cy.get('input[type="date"]').eq(0).clear().type('2026-10-01')
      cy.get('input[type="date"]').eq(1).clear().type('2026-10-31')
      ultimaConsultaFoi({ from: '2026-10-01', to: '2026-10-31' })
    })

    it('avisa, não consulta e desabilita a exportação quando a data final é anterior à inicial', () => {
      abrirRelatorios()
      cy.wait('@relatorio')
      cy.contains('button', 'Personalizado').click()
      cy.get('input[type="date"]').eq(0).clear().type('2026-11-10')
      ultimaConsultaFoi({ from: '2026-11-10', to: intervalo(1).to })
      cy.intercept({ method: 'GET', url: ROTA_RELATORIO }, cy.spy().as('semConsulta'))
      cy.get('input[type="date"]').eq(1).clear().type('2026-11-01')
      cy.contains('A data final deve ser igual ou posterior à data inicial.').should('be.visible')
      cy.contains('button', 'Exportar CSV').should('be.disabled')
      cy.get('@semConsulta').should('not.have.been.called')
    })
  })

  describe('Estados', () => {
    it('mostra "Nenhuma retirada no período." quando não há retiradas', () => {
      cy.fixture('relatorio').then((relatorio) => {
        const vazio = { ...relatorio, topRetirados: [], consumoPorCategoria: [], giro: [] }
        cy.intercept({ method: 'GET', url: ROTA_RELATORIO }, { statusCode: 200, body: vazio }).as('relatorio')
        abrirAba('Relatórios')
        cy.wait('@relatorio')
        cy.get('p').filter(':contains("Nenhuma retirada no período.")').should('have.length', 2)
      })
    })

    it('mostra a mensagem da API quando o relatório falha e bloqueia a exportação', () => {
      cy.intercept({ method: 'GET', url: ROTA_RELATORIO }, { statusCode: 500, body: { message: 'Falha ao gerar relatório.' } }).as('relatorio')
      abrirAba('Relatórios')
      cy.wait('@relatorio')
      cy.contains('Falha ao gerar relatório.').should('be.visible')
      cy.contains('button', 'Exportar CSV').should('be.disabled')
    })

    it('operador também acessa os relatórios', () => {
      abrirRelatorios({ papel: 'user' })
      cy.wait('@relatorio')
      valorDoCartao('Total de produtos').should('have.text', '5')
    })
  })

  describe('Exportação em CSV', () => {
    it('baixa o relatório com separador ";" e os dados do período', () => {
      abrirRelatorios()
      cy.wait('@relatorio')
      cy.contains('button', 'Exportar CSV').should('be.enabled').click()
      cy.readFile(`${Cypress.config('downloadsFolder')}/relatorio-2026-10-13_a_2026-11-11.csv`, 'utf8').then((csv) => {
        expect(csv).to.include('Resumo')
        expect(csv).to.include('Período;2026-10-13 a 2026-11-11')
        expect(csv).to.include('Total de produtos;5')
        expect(csv).to.include('Total de saídas;12,5')
        expect(csv).to.include('1;Arroz 5kg;7,5')
        expect(csv).to.include('Café 500g;Alimentos;PCT;0;2;—')
      })
    })
  })
})
