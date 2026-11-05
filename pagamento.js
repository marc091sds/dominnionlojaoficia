// Cria o pagamento no Mercado Pago (Checkout Pro: Pix, cartão e demais meios da sua conta).
const { cat, J, pv, linhas, cotar } = require('./_lib');
exports.handler = async e => {
  if (e.httpMethod === 'GET') return J(200, { ok: true, pagamento: !!process.env.MP_ACCESS_TOKEN });   // teste: abra este endereço no navegador
  if (e.httpMethod !== 'POST') return J(405, { erro: 'Método inválido' });
  try {
    if (!process.env.MP_ACCESS_TOKEN) throw new Error('Pagamento não configurado');
    const b = JSON.parse(e.body || '{}'), c = b.cliente || {}, cep = String(b.cep || '').replace(/\D/g, '');
    if (cep.length !== 8 || !c.nome || !/^\S+@\S+\.\S+$/.test(c.email || '') || !c.endereco) throw new Error('Dados incompletos');
    const ls = await linhas(b.items, e);
    const frete = (await cotar(cep, ls)).find(o => o.id === b.freteId);   // frete recotado no servidor
    if (!frete) throw new Error('Frete indisponível');
    const pc = cat.cupons[String(b.cupom || '').toUpperCase()] || 0;
    const ref = 'DOM-' + Date.now().toString(36).toUpperCase(), site = process.env.SITE_URL || process.env.URL;
    const body = {
      items: ls.map(({ p, q }) => ({ id: p.id, title: p.nome, quantity: q, currency_id: 'BRL', unit_price: +(pv(p) * (1 - pc / 100)).toFixed(2) })),
      payer: { name: c.nome, email: c.email, phone: { number: String(c.tel || '').replace(/\D/g, '') } },
      shipments: { mode: 'not_specified', cost: frete.valor, receiver_address: { zip_code: cep, street_name: c.endereco } },
      back_urls: { success: `${site}/?pedido=ok&ref=${ref}`, pending: `${site}/?pedido=pendente&ref=${ref}`, failure: `${site}/?pedido=erro&ref=${ref}` },
      auto_return: 'approved', external_reference: ref, statement_descriptor: 'DOMINNION',
      notification_url: `${site}/.netlify/functions/webhook`,
      metadata: { cliente: c, cep, frete, cupom: pc ? b.cupom : null, itens: ls.map(({ p, q }) => ({ id: p.id, nome: p.nome, q })) }
    };
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.init_point) { console.error('Mercado Pago recusou', r.status, JSON.stringify(d).slice(0, 600)); throw new Error('O Mercado Pago não aceitou o pedido' + (d.message ? ': ' + d.message : '')); }
    return J(200, { url: d.init_point, ref });
  } catch (err) { return J(400, { erro: err.message }); }
};
