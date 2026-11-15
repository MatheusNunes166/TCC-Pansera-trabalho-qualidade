import { abrirEquipe } from '../../support/equipe'

const linha = (nome) => cy.contains('tr', nome)
const campo = (rotulo) => cy.contains('label', rotulo).parent().find('input, select')

describe('Gestão — equipe e cargos', () => {
  describe('Acesso à aba por cargo', () => {
    it('administrador vê a aba Equipe', () => {
      abrirEquipe({ papel: 'admin' })
      cy.contains('h2', 'Membros da equipe').should('be.visible')
    })

    it('sócio vê a aba Equipe', () => {
      abrirEquipe({ papel: 'socio', sessao: { id: 2, nome: 'Carla Sócia' } })
      cy.contains('h2', 'Membros da equipe').should('be.visible')
    })

    it('operador não vê a aba Equipe, mas vê as demais', () => {
      cy.stubApiPadrao()
      cy.visitAutenticado('/dashboard', { role: 'user' }, { stubs: false })
      cy.get('button[title="Equipe"]').should('not.exist')
      ;['Início', 'Produtos', 'Movimentações', 'Relatórios'].forEach((aba) => {
        cy.get(`button[title="${aba}"]`).should('be.visible')
      })
    })
  })

  describe('Lista de membros', () => {
    beforeEach(() => abrirEquipe())

    it('mostra nome, e-mail, cargo e status de cada membro', () => {
      linha('Carla Sócia').should('contain', 'carla@exemplo.com').and('contain', 'Sócio').and('contain', 'Ativo')
      linha('Diego Operador').should('contain', 'Operador')
      linha('Eva Inativa').should('contain', 'Inativo')
    })

    it('identifica o usuário logado e não oferece ações sobre ele mesmo', () => {
      linha('Usuário Teste').should('contain', '(você)').and('contain', 'Administrador')
      linha('Usuário Teste').find('select, button').should('not.exist')
    })

    it('ordena por nome', () => {
      cy.contains('th', 'Nome').find('button').click()
      cy.get('tbody tr').first().should('contain', 'Carla Sócia')
      cy.contains('th', 'Nome').find('button').click()
      cy.get('tbody tr').first().should('contain', 'Usuário Teste')
    })
  })

  describe('Hierarquia de cargos', () => {
    it('administrador pode atribuir qualquer cargo', () => {
      abrirEquipe({ papel: 'admin' })
      linha('Diego Operador').find('select[title="Alterar cargo"] option').then(($o) => {
        expect([...$o].map((o) => o.textContent)).to.deep.eq(['Administrador', 'Sócio', 'Operador'])
      })
    })

    it('sócio só atribui Sócio ou Operador e não gerencia o administrador', () => {
      abrirEquipe({ papel: 'socio', sessao: { id: 2, nome: 'Carla Sócia' } })
      linha('Usuário Teste').find('select, button').should('not.exist')
      linha('Diego Operador').find('select[title="Alterar cargo"] option').then(($o) => {
        expect([...$o].map((o) => o.textContent)).to.deep.eq(['Sócio', 'Operador'])
      })
    })
  })

  describe('Ações sobre um membro', () => {
    beforeEach(() => abrirEquipe())

    it('altera o cargo e atualiza a lista', () => {
      linha('Diego Operador').find('select[title="Alterar cargo"]').select('Sócio')
      cy.wait('@alterarCargo').then(({ request }) => {
        expect(request.url).to.match(/\/api\/users\/3\/role$/)
        expect(request.body).to.deep.equal({ role: 'socio' })
      })
      linha('Diego Operador').find('select[title="Alterar cargo"]').should('have.value', 'socio')
    })

    it('mostra o alerta da API quando a troca de cargo é recusada', () => {
      cy.intercept({ method: 'PUT', url: /\/role$/ }, { statusCode: 403, body: { message: 'Sem permissão para este cargo.' } }).as('recusa')
      const alerta = cy.stub().as('alerta')
      cy.on('window:alert', alerta)
      linha('Diego Operador').find('select[title="Alterar cargo"]').select('Sócio')
      cy.wait('@recusa')
      cy.get('@alerta').should('have.been.calledWith', 'Sem permissão para este cargo.')
    })

    it('desativa e reativa o acesso do membro', () => {
      linha('Diego Operador').contains('button', 'Desativar').click()
      cy.wait('@alterarStatus').its('request.url').should('match', /\/api\/users\/3\/status$/)
      linha('Diego Operador').should('contain', 'Inativo').find('button').contains('Ativar')
      linha('Diego Operador').contains('button', 'Ativar').click()
      cy.wait('@alterarStatus')
      linha('Diego Operador').should('contain', 'Ativo')
    })

    it('reativa um membro inativo', () => {
      linha('Eva Inativa').contains('button', 'Ativar').click()
      cy.wait('@alterarStatus')
      linha('Eva Inativa').should('contain', 'Ativo').and('not.contain', 'Inativo')
    })

    it('remove o membro depois de confirmar', () => {
      cy.on('window:confirm', (texto) => {
        expect(texto).to.eq('Remover "Diego Operador" permanentemente? Esta ação não pode ser desfeita.')
        return true
      })
      linha('Diego Operador').contains('button', 'Remover').click()
      cy.wait('@removerUsuario').its('request.url').should('match', /\/api\/users\/3$/)
      cy.contains('td', 'Diego Operador').should('not.exist')
    })

    it('não remove o membro quando a confirmação é cancelada', () => {
      cy.intercept({ method: 'DELETE', url: /\/api\/users\/\d+$/ }, cy.spy().as('api'))
      cy.on('window:confirm', () => false)
      linha('Diego Operador').contains('button', 'Remover').click()
      cy.get('@api').should('not.have.been.called')
      cy.contains('td', 'Diego Operador').should('exist')
    })
  })

  describe('Adicionar membro', () => {
    beforeEach(() => {
      abrirEquipe()
      cy.contains('button', '+ Adicionar membro').click()
      cy.contains('h2', 'Adicionar Membro').should('be.visible')
    })

    it('oferece todos os cargos para o administrador, com "Operador" já selecionado', () => {
      campo('Cargo').should('have.value', 'user')
      campo('Cargo').find('option').then(($o) => {
        expect([...$o].map((o) => o.textContent)).to.deep.eq(['Operador', 'Sócio', 'Administrador'])
      })
    })

    it('exige todos os campos e não chama a API', () => {
      cy.intercept('POST', '**/api/users', cy.spy().as('api'))
      cy.contains('button', 'Criar conta').click()
      cy.contains('Nome é obrigatório.').should('be.visible')
      cy.contains('E-mail é obrigatório.').should('be.visible')
      cy.contains('CPF é obrigatório.').should('be.visible')
      cy.contains('Senha é obrigatória.').should('be.visible')
      cy.get('@api').should('not.have.been.called')
    })

    it('valida o formato do e-mail e o tamanho da senha', () => {
      campo('Nome completo').type('Fábio Novo')
      campo('E-mail').type('fabio@exemplo')
      campo('CPF (para recuperação de acesso)').type('12345678901')
      campo('Senha').type('12345')
      cy.contains('button', 'Criar conta').click()
      cy.contains('E-mail inválido.').should('be.visible')
      cy.contains('Mínimo 6 caracteres.').should('be.visible')
    })

    it('alterna a visibilidade da senha', () => {
      campo('Senha').should('have.attr', 'type', 'password')
      cy.contains('button', 'Mostrar').click()
      campo('Senha').should('have.attr', 'type', 'text')
      cy.contains('button', 'Ocultar').should('be.visible')
    })

    it('cria o membro e o mostra na lista', () => {
      campo('Nome completo').type('Fábio Novo')
      campo('E-mail').type('fabio@exemplo.com')
      campo('CPF (para recuperação de acesso)').type('12345678901')
      campo('Senha').type('senha123')
      campo('Cargo').select('Sócio')
      cy.contains('button', 'Criar conta').click()
      cy.wait('@criarUsuario').its('request.body').should('deep.equal', {
        nome: 'Fábio Novo',
        cpf_cnpj: '12345678901',
        email: 'fabio@exemplo.com',
        senha: 'senha123',
        role: 'socio',
      })
      cy.contains('h2', 'Adicionar Membro').should('not.exist')
      linha('Fábio Novo').should('contain', 'fabio@exemplo.com').and('contain', 'Sócio')
    })

    it('mantém o modal aberto e mostra a mensagem quando a API recusa', () => {
      cy.intercept('POST', '**/api/users', { statusCode: 409, body: { message: 'E-mail já cadastrado.' } }).as('recusa')
      campo('Nome completo').type('Fábio Novo')
      campo('E-mail').type('carla@exemplo.com')
      campo('CPF (para recuperação de acesso)').type('12345678901')
      campo('Senha').type('senha123')
      cy.contains('button', 'Criar conta').click()
      cy.wait('@recusa')
      cy.contains('E-mail já cadastrado.').should('be.visible')
      cy.contains('h2', 'Adicionar Membro').should('be.visible')
    })

    it('fecha com Cancelar sem criar ninguém', () => {
      cy.intercept('POST', '**/api/users', cy.spy().as('api'))
      cy.contains('button', 'Cancelar').click()
      cy.contains('h2', 'Adicionar Membro').should('not.exist')
      cy.get('@api').should('not.have.been.called')
    })
  })
})
