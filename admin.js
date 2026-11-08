// API do painel (admin.html). Só responde com a senha correta (variável ADMIN_SENHA).
const crypto = require('crypto');
const { J } = require('./_lib');
const { st, lerProdutos, salvarProduto, removerProduto, lerSite, salvarSite } = require('./_lib');

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

// ---- Página: só aceita as chaves conhecidas, com limites de tamanho (o que vier fora disso é descartado)
const TXT = { aviso: 160, hero_tag: 120, hero_btn1: 30, hero_btn2: 30, destaques_t: 60, destaques_s: 160, vitrine_t: 60, vitrine_s: 160, polo_t: 60, polo_s: 200,
  senna_t: 60, senna_s: 200, como_t: 60, como_s: 160, feed_t: 60, feed_s: 160, faq_t: 60, cta_t: 80, cta_s: 160, cta_btn_grupo: 40, cta_btn_ig: 40, rodape_frase: 120, whatsapp_msg: 300 };
const SECOES = ['destaques', 'vitrine', 'polo', 'senna', 'como', 'feed', 'faq', 'cta'];
const IMG = /^(img\/[\w.\-]+|\/\.netlify\/functions\/foto\?k=[a-z0-9]+\.jpg)$/;
const img = v => { v = txt(v, 300); return IMG.test(v) ? v : ''; };
const link = v => { v = txt(v, 300); return /^(https:\/\/[^\s"'<>]{3,290}|#[a-z0-9-]{1,30})$/.test(v) ? v : ''; };
const lista = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
function limparSite(s) {
  s = s && typeof s === 'object' ? s : {}; const o = {};
  for (const k in TXT) { const v = txt(s[k], TXT[k]); if (v) o[k] = v; }
  const wa = String(s.whatsapp || '').replace(/\D/g, ''); if (wa.length >= 10 && wa.length <= 15) o.whatsapp = wa;
  for (const k of ['instagram', 'grupo']) { const v = link(s[k]); if (v && v[0] !== '#') o[k] = v; }
  for (const k of ['cor_destaque', 'cor_fundo']) { const v = txt(s[k], 7); if (/^#[0-9a-fA-F]{6}$/.test(v)) o[k] = v; }
  if (img(s.hero_imagem)) o.hero_imagem = img(s.hero_imagem);
  o.passos = lista(s.passos, 3).map(x => ({ t: txt(x && x.t, 60), s: txt(x && x.s, 200) })).filter(x => x.t || x.s);
  o.selos = lista(s.selos, 4).map(x => ({ i: txt(x && x.i, 8), t: txt(x && x.t, 60) })).filter(x => x.t);
  o.faq = lista(s.faq, 12).map(x => ({ q: txt(x && x.q, 160), a: txt(x && x.a, 600) })).filter(x => x.q && x.a);
  o.feedbacks = lista(s.feedbacks, 8).map(img).filter(Boolean);
  o.blocos = lista(s.blocos, 3).map(x => x = x || {}).map(x => ({ t: txt(x.t, 80), s: txt(x.s, 800), img: img(x.img), btn: txt(x.btn, 30), link: link(x.link) })).filter(x => x.t || x.s || x.img);
  o.secoes = {}; for (const k of SECOES) o.secoes[k] = !(s.secoes && s.secoes[k] === false);
  return o;
}

async function login(e, senha) {
  const sen = (process.env.ADMIN_SENHA || '').trim();
  if (!sen) return J(500, { erro: 'O servidor não encontrou a variável ADMIN_SENHA. Crie-a no Netlify (Environment variables) e faça um novo deploy.' });
  if (sen.length < 10) return J(500, { erro: 'A ADMIN_SENHA salva no Netlify tem só ' + sen.length + ' caracteres, e precisa ter pelo menos 10. Edite o valor e faça um novo deploy.' });
  const seg = st(e, 'seg'); let f = (await seg.get('falhas', { type: 'json' })) || { n: 0, ate: 0 };
  if (f.ate > Date.now()) return J(429, { erro: 'Muitas tentativas. Aguarde 15 minutos.' });
  if (!iguais(String(senha || '').trim(), sen)) {
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
        const n = await salvarProduto(e, limpar(b.produto || {})); return J(200, { produto: n });
      }
      case 'excluir': {
        if (!/^[a-z0-9-]{1,60}$/.test(b.id || '')) throw new Error('Produto inválido');
        await removerProduto(e, b.id); return J(200, { ok: true });
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
      case 'site_ler': return J(200, { site: await lerSite(e) });
      case 'site_salvar': { const o = limparSite(b.site); await salvarSite(e, o); return J(200, { site: o }); }
      case 'diag': {   // mostra no painel o que está ligado e, se o armazenamento falhar, o motivo
        let erro = ''; try { await st(e, 'loja').list({ prefix: 'p:' }); } catch (err) { erro = err.message; }
        return J(200, { armazenamento: !erro, erro, pagamento: !!process.env.MP_ACCESS_TOKEN, frete: !!process.env.CEP_ORIGEM && !!(process.env.SF_TOKEN || process.env.ME_TOKEN) });
      }
      default: return J(400, { erro: 'Ação inválida' });
    }
  } catch (err) { console.error('admin', err.message); return J(400, { erro: err.message }); }
};
