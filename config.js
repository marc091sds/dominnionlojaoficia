// Diz à loja o que está ligado (só sim/não, sem segredos). Se o pagamento ou o frete não estiverem configurados, a loja usa o pedido pelo WhatsApp.
const { st, VERSAO } = require('./_lib');
exports.handler = async e => {
  let armazenamento = true;
  try { await st(e, 'seg').get('ping'); } catch (err) { armazenamento = false; }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ pagamento: !!process.env.MP_ACCESS_TOKEN, frete: !!process.env.CEP_ORIGEM && !!(process.env.SF_TOKEN || process.env.ME_TOKEN), armazenamento, versao: VERSAO }) };
};
