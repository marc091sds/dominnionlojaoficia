// Recebe o aviso do Mercado Pago, valida, confere o pagamento na API, guarda o pedido e baixa o estoque.
const crypto = require('crypto');
const { st, baixarEstoque } = require('./_lib');
exports.handler = async e => {
  const q = e.queryStringParameters || {}; let b = {}; try { b = JSON.parse(e.body || '{}'); } catch (x) {}
  const id = String(q['data.id'] || (b.data && b.data.id) || ''), tipo = q.type || b.type || q.topic;
  if (tipo !== 'payment' || !id) return { statusCode: 200, body: 'ignorado' };
  const sec = process.env.MP_WEBHOOK_SECRET;
  if (sec) {
    const sig = e.headers['x-signature'] || '', ts = (sig.match(/ts=([^,]+)/) || [])[1], v1 = (sig.match(/v1=([^,]+)/) || [])[1];
    const h = crypto.createHmac('sha256', sec).update(`id:${id.toLowerCase()};request-id:${e.headers['x-request-id'] || ''};ts:${ts};`).digest('hex');
    if (!v1 || h !== v1) return { statusCode: 401, body: 'assinatura inválida' };
  }
  const r = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN } });
  if (!r.ok) return { statusCode: 502, body: 'falha ao consultar' };
  const p = await r.json(), m = p.metadata || {}, ref = String(p.external_reference || '');
  console.log(JSON.stringify({ pedido: ref, pagamento: p.id, status: p.status, valor: p.transaction_amount }));
  if (/^DOM-[A-Z0-9]+$/.test(ref)) {
    try {
      const ped = st(e, 'pedidos');
      const o = (await ped.get(ref, { type: 'json' })) || { ref, criado: new Date().toISOString(), enviado: false, rastreio: '', baixado: false };
      Object.assign(o, { status: p.status, valor: p.transaction_amount, metodo: p.payment_method_id, pagamento: p.id, cliente: m.cliente, frete: m.frete, cep: m.cep, itens: m.itens || [], cupom: m.cupom || null });
      if (p.status === 'approved' && !o.baixado) {   // baixa o estoque uma única vez
        await baixarEstoque(e, o.itens); o.baixado = true;
      }
      await ped.setJSON(ref, o);
    } catch (err) { console.error('pedido', err.message); return { statusCode: 500, body: 'erro ao salvar' }; }
  }
  return { statusCode: 200, body: 'ok' };
};
