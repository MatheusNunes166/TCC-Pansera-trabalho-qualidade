// Abre o dashboard autenticado numa aba de consulta (Movimentações ou Relatórios) com a API simulada.
// Os testes declaram seus próprios cy.intercept ANTES de chamar abrirAba.
export function abrirAba(aba, { papel = 'admin' } = {}) {
  cy.stubApiPadrao()
  cy.visitAutenticado('/dashboard', { role: papel }, { stubs: false })
  cy.get(`button[title="${aba}"]`).click()
}

const ROTA_MOVIMENTOS = /\/api\/movements(\?.*)?$/

/**
 * Simula GET /api/movements filtrando e paginando como o servidor: tipo, user, q (produto), from, to.
 * Devolve { items, total }. Alias: @movimentos (e @usuariosMovimentos para o filtro de usuário).
 */
export function simularMovimentacoes(base) {
  cy.intercept('GET', '**/api/movements/users', { statusCode: 200, body: ['Ana Lima', 'Bruno Reis'] }).as('usuariosMovimentos')
  cy.intercept({ method: 'GET', url: ROTA_MOVIMENTOS }, (req) => {
    const p = new URL(req.url).searchParams
    let itens = base
    if (p.get('tipo')) itens = itens.filter((m) => m.tipo === p.get('tipo'))
    if (p.get('user')) itens = itens.filter((m) => m.user_nome === p.get('user'))
    if (p.get('q')) itens = itens.filter((m) => m.product_nome.toLowerCase().includes(p.get('q').toLowerCase()))
    const pagina = Number(p.get('page') || 1)
    const tamanho = Number(p.get('pageSize') || 8)
    req.reply({ items: itens.slice((pagina - 1) * tamanho, pagina * tamanho), total: itens.length })
  }).as('movimentos')
}

/**
 * Garante que a ÚLTIMA requisição do alias contém o trecho esperado (com retentativa).
 * Em desenvolvimento o React (StrictMode) repete a consulta inicial, então `cy.wait` pode devolver
 * uma requisição antiga; olhar a última é o que mostra o efeito do filtro aplicado.
 */
export function ultimaConsultaDeve(alias, ...trechos) {
  cy.get(`@${alias}.all`).should((chamadas) => {
    expect(chamadas.length, 'requisições feitas').to.be.greaterThan(0)
    const url = chamadas[chamadas.length - 1].request.url
    trechos.forEach((t) => expect(url).to.include(t))
  })
}

export { ROTA_MOVIMENTOS }
