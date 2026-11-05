// Lista pública dos produtos ativos. A loja lê daqui a cada poucos segundos (sem cache), então o que você muda no painel aparece quase na hora.
const { ler } = require('./_lib');
exports.handler = async e => {
  const { lista, fonte } = await ler(e);
  const l = lista.filter(p => p.ativo !== false).map(({ peso, largura, altura, comprimento, ...p }) => p);
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Fonte': fonte }, body: JSON.stringify({ produtos: l, fonte }) };
};
