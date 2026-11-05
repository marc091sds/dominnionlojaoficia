// A página de retorno consulta aqui o status real do pedido (não confia no que vem na URL).
const { J } = require('./_lib');
exports.handler = async e => {
  try {
    const ref = String((e.queryStringParameters || {}).ref || '');
    if (!/^DOM-[A-Z0-9]+$/.test(ref)) throw new Error('Referência inválida');
    const r = await fetch('https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&external_reference=' + ref, { headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN } });
    const d = await r.json(), l = d.results || [];
    return J(200, { status: (l.find(x => x.status === 'approved') || l[0] || {}).status || '' });
  } catch (err) { return J(400, { erro: err.message }); }
};
