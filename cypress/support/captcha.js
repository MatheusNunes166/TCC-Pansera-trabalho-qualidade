// O reCAPTCHA não pode ser resolvido pelo Cypress. Quando o frontend sobe com
// VITE_RECAPTCHA_SITE_KEY preenchida, o botão de envio fica desabilitado desde o início.
// Nesse caso os testes que submetem o formulário são marcados como "pending" em vez de falhar.
// Para executá-los, suba o frontend com a chave vazia:
//   VITE_RECAPTCHA_SITE_KEY= npm run dev     (Linux/macOS)
//   $env:VITE_RECAPTCHA_SITE_KEY=""; npm run dev     (PowerShell)
export function pularSeCaptchaAtivo(contexto, rotuloBotao) {
  cy.contains('button', rotuloBotao).then(($botao) => {
    if ($botao.is(':disabled')) {
      cy.log('reCAPTCHA ativo no frontend: teste ignorado')
      contexto.skip()
    }
  })
}
