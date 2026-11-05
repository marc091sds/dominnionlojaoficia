const { J, linhas, cotar } = require('./_lib');
exports.handler = async e => {
  if (e.httpMethod !== 'POST') return J(405, { erro: 'Método inválido' });
  try {
    const b = JSON.parse(e.body || '{}'), cep = String(b.cep || '').replace(/\D/g, '');
    if (cep.length !== 8) throw new Error('CEP inválido');
    return J(200, { opcoes: await cotar(cep, await linhas(b.items, e)) });
  } catch (err) { return J(400, { erro: err.message }); }
};
