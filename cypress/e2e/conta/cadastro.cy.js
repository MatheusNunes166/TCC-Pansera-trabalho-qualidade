import { pularSeCaptchaAtivo } from '../../support/captcha'

const dadosValidos = {
  nome: 'Maria Souza',
  nome_empresa: 'Mercado Central',
  cpf_cnpj: '12345678901',
  email: 'maria@exemplo.com',
  senha: 'senha1234',
  confirmar: 'senha1234',
}

function preencher(dados = {}) {
  const d = { ...dadosValidos, ...dados }
  Object.entries(d).forEach(([campo, valor]) => {
    if (valor !== '') cy.get(`input[name="${campo}"]`).type(valor, { log: campo !== 'senha' && campo !== 'confirmar' })
  })
}

const enviar = () => cy.contains('button', 'CADASTRAR').click()

describe('Cadastro de conta', () => {
  beforeEach(function () {
    cy.visit('/register')
    pularSeCaptchaAtivo(this, 'CADASTRAR')
  })

  it('exibe o formulário completo', () => {
    cy.contains('h1', 'StockFlow — Criar conta').should('be.visible')
    ;['nome', 'nome_empresa', 'cpf_cnpj', 'email', 'senha', 'confirmar'].forEach((campo) => {
      cy.get(`input[name="${campo}"]`).should('be.visible')
    })
    cy.contains('button', 'CADASTRAR').should('be.enabled')
  })

  it('volta para o login pelo link "Já tenho conta"', () => {
    cy.contains('a', 'Já tenho conta').click()
    cy.location('pathname').should('eq', '/')
  })

  it('exige os campos obrigatórios e não chama a API', () => {
    cy.intercept('POST', '**/api/auth/register', cy.spy().as('api'))
    enviar()
    cy.contains('E-mail inválido.').should('be.visible')
    cy.get('p.text-red-500').should('have.length', 5)
    cy.contains('p', 'Campo obrigatório.').should('exist')
    cy.get('@api').should('not.have.been.called')
  })

  it('limpa o erro do campo quando o usuário volta a digitar', () => {
    enviar()
    cy.get('p.text-red-500').should('have.length', 5)
    cy.get('input[name="nome"]').type('Maria')
    cy.get('p.text-red-500').should('have.length', 4)
  })

  it('rejeita e-mail sem domínio completo (validação do app)', () => {
    preencher({ email: 'maria@exemplo' })
    enviar()
    cy.contains('E-mail inválido.').should('be.visible')
  })

  it('bloqueia e-mail sem arroba pela validação do navegador, sem chamar a API', () => {
    cy.intercept('POST', '**/api/auth/register', cy.spy().as('api'))
    preencher({ email: 'sem-arroba' })
    enviar()
    cy.get('input[name="email"]').then(($input) => expect($input[0].validity.valid).to.be.false)
    cy.get('@api').should('not.have.been.called')
    cy.location('pathname').should('eq', '/register')
  })

  it('exige senha com no mínimo 8 caracteres', () => {
    preencher({ senha: '1234567', confirmar: '1234567' })
    enviar()
    cy.contains('Mínimo 8 caracteres.').should('be.visible')
  })

  it('exige que a confirmação seja igual à senha', () => {
    preencher({ confirmar: 'outrasenha1' })
    enviar()
    cy.contains('As senhas não coincidem.').should('be.visible')
  })

  it('formata CPF e CNPJ enquanto digita', () => {
    cy.get('input[name="cpf_cnpj"]').type('12345678901').should('have.value', '123.456.789-01')
    cy.get('input[name="cpf_cnpj"]').clear().type('12345678000195').should('have.value', '12.345.678/0001-95')
  })

  it('cadastra a conta e redireciona para o login com a mensagem de sucesso', () => {
    cy.intercept('POST', '**/api/auth/register', { statusCode: 201, body: { message: 'ok' } }).as('registro')
    preencher()
    enviar()
    cy.wait('@registro').its('request.body').should('deep.include', {
      nome: 'Maria Souza',
      nome_empresa: 'Mercado Central',
      cpf_cnpj: '123.456.789-01',
      email: 'maria@exemplo.com',
      senha: 'senha1234',
    })
    cy.location('pathname').should('eq', '/')
    cy.location('search').should('eq', '?success=cadastro')
    cy.contains('Conta criada com sucesso! Faça seu login.').should('be.visible')
  })

  it('mostra o erro do servidor junto ao campo indicado (e-mail já cadastrado)', () => {
    cy.intercept('POST', '**/api/auth/register', {
      statusCode: 409,
      body: { message: 'E-mail já cadastrado.', field: 'email' },
    }).as('registro')
    preencher()
    enviar()
    cy.wait('@registro')
    cy.contains('p.text-red-500', 'E-mail já cadastrado.').should('be.visible')
    cy.location('pathname').should('eq', '/register')
  })

  it('mostra erro genérico quando a API falha sem indicar o campo', () => {
    cy.intercept('POST', '**/api/auth/register', { statusCode: 500, body: {} }).as('registro')
    preencher()
    enviar()
    cy.wait('@registro')
    cy.contains('Erro ao cadastrar.').should('be.visible')
    cy.contains('button', 'CADASTRAR').should('be.enabled')
  })

  it('desabilita o botão enquanto o cadastro é enviado', () => {
    cy.intercept('POST', '**/api/auth/register', { statusCode: 201, body: {}, delay: 800 }).as('registro')
    preencher()
    enviar()
    cy.contains('button', 'Cadastrando...').should('be.disabled')
    cy.wait('@registro')
  })
})
