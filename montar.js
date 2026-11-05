// Monta o site na hora da publicação (roda sozinho no Netlify):
//  - copia as páginas para a pasta "dist" (a única pasta que fica pública)
//  - copia as funções (pagamento, frete, painel...) para "netlify/functions"
// Assim você pode enviar todos os arquivos soltos para o GitHub, sem criar pastas.
const fs = require('fs'), path = require('path');
const FUNCOES = ['_lib.js', 'admin.js', 'config.js', 'foto.js', 'frete.js', 'pagamento.js', 'produtos.js', 'status.js', 'webhook.js', 'catalogo.json'];
const PAGINAS = ['index.html', 'admin.html', 'diagnostico.html'];
const FUN_DIR = path.join('netlify', 'functions');
const achar = n => [n, path.join(FUN_DIR, n)].find(p => fs.existsSync(p));   // aceita soltos na raiz ou já dentro de netlify/functions

fs.mkdirSync('dist', { recursive: true });
fs.mkdirSync(FUN_DIR, { recursive: true });
const faltando = [];
for (const n of FUNCOES) {
  const o = achar(n); if (!o) { faltando.push(n); continue; }
  const d = path.join(FUN_DIR, n);
  if (path.resolve(o) !== path.resolve(d)) fs.copyFileSync(o, d);
}
for (const n of PAGINAS) {
  if (fs.existsSync(n)) fs.copyFileSync(n, path.join('dist', n));
  else if (n === 'index.html') faltando.push(n);
}
if (fs.existsSync('img')) fs.cpSync('img', path.join('dist', 'img'), { recursive: true });
if (faltando.length) { console.error('ERRO: faltam estes arquivos no repositório do GitHub: ' + faltando.join(', ')); process.exit(1); }
console.log('Montagem concluída: ' + FUNCOES.length + ' arquivos de funções e as páginas do site.');
