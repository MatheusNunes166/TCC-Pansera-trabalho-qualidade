import { pularSeCaptchaAtivo } from '../../support/captcha'

const EMAIL = 'maria@exemplo.com'
const CPF = '12345678901'

function etapa1() {
  cy.get('input[type="email"]').type(EMAIL)
  cy.get('input[placeholder="000.000.000-00"]').type(CPF)
  cy.contains('button', 'AVANÇAR').click()
}

function digitarCodigo(codigo) {
  codigo.split('').forEach((digito, i) => {
    cy.get('input[inputmode="numeric"]').eq(i).type(digito)
  })
}

function avancarAteCodigo() {
  cy.intercept('POST', '**/api/auth/forgot-password', { statusCode: 200, body: { message: 'ok' } }).as('forgot')
  etapa1()
  cy.wait('@forgot')
  cy.contains('h2', 'Insira o código').should('be.visible')
}

function avancarAteNovaSenha() {
  avancarAteCodigo()
  cy.intercept('POST', '**/api/auth/verify-code', { statusCode: 200, body: { resetToken: 'token-de-reset' } }).as('verify')
  digitarCodigo('123456')
  cy.contains('button', 'CONFIRMAR').click()
  cy.wait('@verify')
  cy.contains('h2', 'Nova senha').should('be.visible')
}

describe('Recuperação de senha', () => {
  beforeEach(function () {
    cy.visit('/forgot-password')
    pularSeCaptchaAtivo(this, 'AVANÇAR')
  })

  describe('Etapa 1 — identificação da conta', () => {
    it('exibe o formulário de recuperação', () => {
      cy.contains('h2', 'Recuperar acesso').should('be.visible')
      cy.get('input[type="email"]').should('be.visible')
      cy.contains('button', 'AVANÇAR').should('be.enabled')
    })

    it('volta para o login', () => {
      cy.contains('a', 'Voltar para o login').click()
      cy.location('pathname').should('eq', '/')
    })

    it('exige e-mail e CPF/CNPJ', () => {
      cy.contains('button', 'AVANÇAR').click()
      cy.contains('Preencha todos os campos.').should('be.visible')
    })

    it('formata o CPF enquanto digita', () => {
      cy.get('input[placeholder="000.000.000-00"]').type(CPF).should('have.value', '123.456.789-01')
    })

    it('mostra erro quando a API recusa a solicitação', () => {
      cy.intercept('POST', '**/api/auth/forgot-password', { statusCode: 404, body: {} }).as('forgot')
      etapa1()
      cy.wait('@forgot')
      cy.contains('Erro ao processar. Tente novamente.').should('be.visible')
      cy.contains('h2', 'Recuperar acesso').should('be.visible')
    })

    it('envia e-mail e CPF e avança para a etapa do código', () => {
      cy.intercept('POST', '**/api/auth/forgot-password', { statusCode: 200, body: {} }).as('forgot')
      etapa1()
      cy.wait('@forgot').its('request.body').should('deep.include', { email: EMAIL, cpf_cnpj: '123.456.789-01' })
      cy.contains('h2', 'Insira o código').should('be.visible')
    })
  })

  describe('Etapa 2 — código de verificação', () => {
    it('mostra o e-mail mascarado e o contador para reenvio', () => {
      avancarAteCodigo()
      cy.contains('m***@exemplo.com').should('be.visible')
      cy.contains(/Reenviar código em 00:\d\d/).should('be.visible')
      cy.get('input[inputmode="numeric"]').should('have.length', 6)
    })

    it('move o foco para o próximo campo a cada dígito', () => {
      avancarAteCodigo()
      cy.get('input[inputmode="numeric"]').eq(0).type('1')
      cy.get('input[inputmode="numeric"]').eq(1).should('have.focus')
    })

    it('aceita somente números nos campos do código', () => {
      avancarAteCodigo()
      cy.get('input[inputmode="numeric"]').eq(0).type('a').should('have.value', '')
    })

    it('exige os 6 dígitos', () => {
      avancarAteCodigo()
      digitarCodigo('123')
      cy.contains('button', 'CONFIRMAR').click()
      cy.contains('Digite todos os 6 dígitos.').should('be.visible')
    })

    it('mostra erro para código inválido ou expirado', () => {
      avancarAteCodigo()
      cy.intercept('POST', '**/api/auth/verify-code', { statusCode: 400, body: {} }).as('verify')
      digitarCodigo('000000')
      cy.contains('button', 'CONFIRMAR').click()
      cy.wait('@verify')
      cy.contains('Código inválido ou expirado.').should('be.visible')
    })

    it('valida o código e avança para a nova senha', () => {
      avancarAteCodigo()
      cy.intercept('POST', '**/api/auth/verify-code', { statusCode: 200, body: { resetToken: 'token-de-reset' } }).as('verify')
      digitarCodigo('123456')
      cy.contains('button', 'CONFIRMAR').click()
      cy.wait('@verify').its('request.body').should('deep.equal', { email: EMAIL, code: '123456' })
      cy.contains('h2', 'Nova senha').should('be.visible')
    })
  })

  describe('Etapa 3 — nova senha', () => {
    const salvar = () => cy.contains('button', 'SALVAR SENHA').click()
    const preencherSenhas = (senha, confirmar) => {
      cy.get('input[placeholder="••••••••"]').eq(0).type(senha)
      cy.get('input[placeholder="••••••••"]').eq(1).type(confirmar)
    }

    it('exige que a confirmação seja igual', () => {
      avancarAteNovaSenha()
      preencherSenhas('novasenha123', 'diferente123')
      salvar()
      cy.contains('As senhas não coincidem.').should('be.visible')
    })

    it('exige no mínimo 8 caracteres', () => {
      avancarAteNovaSenha()
      preencherSenhas('1234567', '1234567')
      salvar()
      cy.contains('Mínimo 8 caracteres.').should('be.visible')
    })

    it('mostra erro quando o token de redefinição expirou', () => {
      avancarAteNovaSenha()
      cy.intercept('POST', '**/api/auth/reset-password', { statusCode: 400, body: {} }).as('reset')
      preencherSenhas('novasenha123', 'novasenha123')
      salvar()
      cy.wait('@reset')
      cy.contains('Token inválido ou expirado. Recomece o processo.').should('be.visible')
    })

    it('redefine a senha e volta ao login com a mensagem de sucesso', () => {
      avancarAteNovaSenha()
      cy.intercept('POST', '**/api/auth/reset-password', { statusCode: 200, body: {} }).as('reset')
      preencherSenhas('novasenha123', 'novasenha123')
      salvar()
      cy.wait('@reset').its('request.body').should('deep.equal', { resetToken: 'token-de-reset', novaSenha: 'novasenha123' })
      cy.location('pathname').should('eq', '/')
      cy.location('search').should('eq', '?success=senha')
      cy.contains('Senha alterada com sucesso! Faça seu login.').should('be.visible')
    })
  })
})
