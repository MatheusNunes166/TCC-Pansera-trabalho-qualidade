// Simula a API de usuários (equipe) com estado em memória. Nada toca o banco.
// Aliases: @listarUsuarios, @criarUsuario, @alterarCargo, @alterarStatus, @removerUsuario.
export function simularEquipe(usuariosIniciais) {
  const estado = { usuarios: Cypress._.cloneDeep(usuariosIniciais), proximoId: 100 }
  const idDaUrl = (url) => Number(new URL(url).pathname.split('/')[3])
  const achar = (req) => estado.usuarios.find((u) => u.id === idDaUrl(req.url))

  cy.intercept('GET', '**/api/users', (req) => req.reply(estado.usuarios)).as('listarUsuarios')

  cy.intercept('POST', '**/api/users', (req) => {
    const novo = { id: estado.proximoId++, ativo: true, email: req.body.email, nome: req.body.nome, role: req.body.role }
    estado.usuarios.push(novo)
    req.reply({ statusCode: 201, body: novo })
  }).as('criarUsuario')

  cy.intercept({ method: 'PUT', url: /\/api\/users\/\d+\/role$/ }, (req) => {
    const u = achar(req)
    u.role = req.body.role
    req.reply({ statusCode: 200, body: u })
  }).as('alterarCargo')

  cy.intercept({ method: 'PUT', url: /\/api\/users\/\d+\/status$/ }, (req) => {
    const u = achar(req)
    u.ativo = !u.ativo
    req.reply({ statusCode: 200, body: { ativo: u.ativo } })
  }).as('alterarStatus')

  cy.intercept({ method: 'DELETE', url: /\/api\/users\/\d+$/ }, (req) => {
    estado.usuarios = estado.usuarios.filter((u) => u.id !== idDaUrl(req.url))
    req.reply({ statusCode: 200, body: { message: 'ok' } })
  }).as('removerUsuario')

  return estado
}

/**
 * Abre a aba Equipe autenticado com o cargo informado.
 * @param {{ papel?: 'admin'|'socio'|'user', sessao?: object, usuarios?: object[] }} opcoes
 *   `sessao` sobrescreve dados do usuário logado (ex.: { id: 2, nome: 'Carla Sócia' }).
 */
export function abrirEquipe({ papel = 'admin', sessao = {}, usuarios } = {}) {
  cy.fixture('usuarios').then((base) => {
    cy.stubApiPadrao()
    simularEquipe(usuarios ?? base)
    cy.visitAutenticado('/dashboard', { role: papel, ...sessao }, { stubs: false })
    cy.get('button[title="Equipe"]').click()
    cy.wait('@listarUsuarios')
  })
}
