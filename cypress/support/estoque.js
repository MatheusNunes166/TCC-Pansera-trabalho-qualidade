// Simula a API de produtos com estado em memória: criar, editar, remover e retirar alteram a
// lista devolvida pelo próximo GET, como o backend faria. Nada toca o banco.
// Cada rota tem um alias (@listarProdutos, @criarProduto, @editarProduto, @removerProduto, @retirarProduto).
export function simularEstoque(produtosIniciais) {
  const estado = { produtos: Cypress._.cloneDeep(produtosIniciais), proximoId: 100 }
  const idDaUrl = (url) => Number(new URL(url).pathname.split('/')[3])

  cy.intercept('GET', '**/api/products', (req) => req.reply(estado.produtos)).as('listarProdutos')

  cy.intercept('POST', '**/api/products', (req) => {
    const novo = { id: estado.proximoId++, categoria: null, fornecedor: null, created_at: new Date().toISOString(), ...req.body }
    estado.produtos.push(novo)
    req.reply({ statusCode: 201, body: novo })
  }).as('criarProduto')

  cy.intercept({ method: 'PUT', url: /\/api\/products\/\d+$/ }, (req) => {
    const p = estado.produtos.find((x) => x.id === idDaUrl(req.url))
    Object.assign(p, req.body)
    req.reply({ statusCode: 200, body: p })
  }).as('editarProduto')

  cy.intercept({ method: 'DELETE', url: /\/api\/products\/\d+$/ }, (req) => {
    estado.produtos = estado.produtos.filter((x) => x.id !== idDaUrl(req.url))
    req.reply({ statusCode: 200, body: { message: 'ok' } })
  }).as('removerProduto')

  cy.intercept({ method: 'POST', url: /\/api\/products\/\d+\/withdraw$/ }, (req) => {
    const p = estado.produtos.find((x) => x.id === idDaUrl(req.url))
    p.quantidade = Number(p.quantidade) - Number(req.body.quantidade)
    req.reply({ statusCode: 200, body: p })
  }).as('retirarProduto')

  return estado
}

/**
 * Abre o dashboard autenticado com o estoque simulado.
 * @param {{ papel?: 'admin'|'socio'|'user', produtos?: object[], aba?: string }} opcoes
 *   `aba` = título do botão da navegação a abrir em seguida (ex.: 'Produtos').
 */
export function abrirEstoque({ papel = 'admin', produtos, aba } = {}) {
  cy.fixture('estoque').then((base) => {
    cy.stubApiPadrao()
    simularEstoque(produtos ?? base)
    cy.visitAutenticado('/dashboard', { role: papel }, { stubs: false })
    cy.wait('@listarProdutos')
    if (aba) cy.get(`button[title="${aba}"]`).click()
  })
}
