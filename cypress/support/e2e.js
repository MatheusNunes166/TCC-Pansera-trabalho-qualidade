// Carregado automaticamente antes de cada spec.
import './commands'

// Erros não tratados da aplicação (ex.: ResizeObserver) não devem derrubar o teste.
Cypress.on('uncaught:exception', (err) => {
  if (/ResizeObserver loop/.test(err.message)) return false
})
