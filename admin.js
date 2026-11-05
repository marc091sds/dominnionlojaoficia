// API do painel (admin.html). Só responde com a senha correta (variável ADMIN_SENHA).
const crypto = require('crypto');
const { J } = require('./_lib');
const { st, lerProdutos, salvarProdutos } = require('./_lib');

const chave = () => crypto.createHash('sha256').update('dominnion-admin|' + (process.env.ADMIN_SENHA || '')).digest();
const assinar = () => { const p = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 3600e3 })).toString('base64url'); return p + '.' + crypto.createHmac('sha256', chave()).update(p).digest('base64url'); };
const iguais = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const tokenOk = t => {
  const [p, s] = String(t || '').split('.'); if (!p || !s) return false;
  if (!iguais(s, crypto.createHmac('sha256', chave()).update(p).digest('base64url'))) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > Date.now(); } catch (e) { return false; }
};
const num = (v, d = 0) => { v = +String(v).replace(',', '.'); return isFinite(v) && v >= 0 ? v : d; };
const txt = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'produto';

function limpar(p) {
  const nome = txt(p.nome, 80); if (!nome) throw new Error('Informe o nome do produto');
  const preco = num(p.preco); if (!(preco > 0)) throw new Error('Informe o preço');
  const id = /^[a-z0-9-]{1,60}$/.test(p.id || '') ? p.id : slug(nome) + '-' + Date.now().toString(36).slice(-4);
  const imagens = (Array.isArray(p.imagens) ? p.imagens : []).map(s => txt(s, 300))
    .filter(s => /^(img\/[\w.\-]+|\/\.netlify\/functions\/foto\?k=[a-z0-9]+\.jpg)$/.test(s)).slice(0, 3);
  return { id, nome, linha: txt(p.linha, 60) || 'Outros', cat: txt(p.cat, 40) || 'Bonés', cor: txt(p.cor, 30), aba: txt(p.aba, 20) || 'Curva',
    preco, precoDe: num(p.precoDe), precoPromo: 0, badge: ['NOVO', 'OFERTA', 'MAIS VENDIDO'].includes(p.badge) ? p.badge : '',
    descricao: txt(p.descricao, 300), estoque: Math.floor(num(p.estoque)), destaque: !!p.destaque, ativo: p.ativo !== false,
    peso: num(p.peso, 0.25) || 0.25, largura: num(p.largura, 20) || 20, altura: num(p.altura, 12) || 12, comprimento: num(p.comprimento, 25) || 25, imagens };
}

async function login(e, senha) {
  const sen = process.env.ADMIN_SENHA || '';
  if (sen.length < 10) return J(500, { erro: 'A senha do painel (ADMIN_SENHA) não está configurada ou tem menos de 10 caracteres.' });
  const seg = st(e, 'seg'); let f = (await seg.get('falhas', { type: 'json' })) || { n: 0, ate: 0 };
  if (f.ate > Date.now()) return J(429, { erro: 'Muitas tentativas. Aguarde 15 minutos.' });
  if (!iguais(senha || '', sen)) {
    f.n++; if (f.n >= 5) f = { n: 0, ate: Date.now() + 15 * 60e3 };
    await seg.setJSON('falhas', f); await new Promise(r => setTimeout(r, 800));
    return J(401, { erro: 'Senha incorreta.' });
  }
  await seg.setJSON('falhas', { n: 0, ate: 0 });
  return J(200, { token: assinar() });
}

exports.handler = async e => {
  if (e.httpMethod !== 'POST') return J(405, { erro: 'Método inválido' });
  try {
    const b = JSON.parse(e.body || '{}');
    if (b.acao === 'login') return await login(e, b.senha);
    if (!process.env.ADMIN_SENHA || !tokenOk((e.headers.authorization || '').replace(/^Bearer /, ''))) return J(401, { erro: 'Sessão expirada. Entre de novo.' });
    switch (b.acao) {
      case 'listar': return J(200, { produtos: await lerProdutos(e) });
      case 'salvar': {
        const l = await lerProdutos(e), n = limpar(b.produto || {}), i = l.findIndex(x => x.id === n.id);
        i >= 0 ? l[i] = n : l.push(n); await salvarProdutos(e, l); return J(200, { produto: n });
      }
      case 'excluir': {
        const l = (await lerProdutos(e)).filter(x => x.id !== b.id); await salvarProdutos(e, l); return J(200, { ok: true });
      }
      case 'upload': {
        const d = String(b.dados || ''); if (d.length > 2.2e6) throw new Error('Foto muito grande');
        const buf = Buffer.from(d, 'base64'); if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('Envie uma foto JPG');
        const k = Date.now().toString(36) + crypto.randomBytes(3).toString('hex') + '.jpg';
        await st(e, 'fotos').set(k, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
        return J(200, { url: '/.netlify/functions/foto?k=' + k });
      }
      case 'pedidos': {
        const ped = st(e, 'pedidos'), { blobs } = await ped.list();
        const ks = blobs.map(x => x.key).sort().reverse().slice(0, 60);
        return J(200, { pedidos: (await Promise.all(ks.map(k => ped.get(k, { type: 'json' })))).filter(Boolean) });
      }
      case 'pedido': {
        if (!/^DOM-[A-Z0-9]+$/.test(b.ref || '')) throw new Error('Pedido inválido');
        const ped = st(e, 'pedidos'), o = await ped.get(b.ref, { type: 'json' }); if (!o) throw new Error('Pedido não encontrado');
        o.enviado = !!b.enviado; o.rastreio = txt(b.rastreio, 40); await ped.setJSON(b.ref, o); return J(200, { ok: true });
      }
      case 'diag': {   // mostra no painel o que está ligado e, se o armazenamento falhar, o motivo
        let erro = ''; try { await st(e, 'loja').get('produtos'); } catch (err) { erro = err.message; }
        return J(200, { armazenamento: !erro, erro, pagamento: !!process.env.MP_ACCESS_TOKEN, frete: !!process.env.CEP_ORIGEM && !!(process.env.SF_TOKEN || process.env.ME_TOKEN) });
      }
      default: return J(400, { erro: 'Ação inválida' });
    }
  } catch (err) { console.error('admin', err.message); return J(400, { erro: err.message }); }
};
