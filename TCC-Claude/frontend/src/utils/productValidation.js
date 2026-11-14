// Valida o formulário de cadastro manual de produto (AddProductModal).
// Campos obrigatórios: nome, quantidade (> 0) e unidade.
// Retorna um objeto { campo: mensagem }; objeto vazio significa dados válidos.
export function validarProduto(form) {
  const e = {};
  if (!form.nome.trim()) e.nome = 'Nome é obrigatório.';
  const qty = parseFloat(form.quantidade);
  if (!form.quantidade.trim()) e.quantidade = 'Quantidade é obrigatória.';
  else if (isNaN(qty) || qty <= 0) e.quantidade = 'Quantidade deve ser um número maior que zero.';
  if (!form.unidade) e.unidade = 'Unidade é obrigatória.';
  return e;
}
