# Testes E2E (Cypress)

Testes de ponta a ponta do StockFlow (`TCC Claude`). Cobrem login, cadastro, recuperação de
senha, produtos, retirada, equipe, movimentações e relatórios.

## Como rodar

1. Instale as dependências, na raiz do repositório:

```bash
npm install
```

2. Em outro terminal, suba o frontend **com o reCAPTCHA desligado**:

```bash
cd "TCC Claude/frontend"
VITE_RECAPTCHA_SITE_KEY= npm run dev
```

No PowerShell: `$env:VITE_RECAPTCHA_SITE_KEY=""; npm run dev`

3. Na raiz, abra o Cypress:

```bash
npm run cy:open   # modo interativo
npm run cy:run    # roda tudo no terminal
```

## Por que desligar o CAPTCHA

O Cypress não resolve CAPTCHA. Com a chave ativa, o botão de cadastro e de recuperação de
senha fica bloqueado e esses testes aparecem como *pending* em vez de rodar. O comando acima só
esvazia a chave nessa execução; o `.env` continua igual.

## Observações

- Os testes usam uma API simulada (`cy.intercept`), então não precisam do backend e não gravam
  nada no banco.
- Dois testes de login com o backend de verdade ficam *pending* até existir um usuário de teste.
  Para ativá-los, copie `cypress.env.example.json` para `cypress.env.json` (fica fora do git),
  preencha o usuário e suba o backend em `localhost:3001`.
- Para rodar só uma parte: `npx cypress run --spec "cypress/e2e/estoque/**"`.

## Pastas

```
cypress/e2e/auth       login e rotas protegidas
cypress/e2e/dashboard  dashboard e sessão
cypress/e2e/conta      cadastro, recuperação de senha, perfil
cypress/e2e/estoque    produtos e retirada
cypress/e2e/gestao     equipe, movimentações, relatórios
cypress/fixtures       dados falsos da API
cypress/support        comandos e simulações reutilizáveis
```
