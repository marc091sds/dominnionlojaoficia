// Entrega as fotos enviadas pelo painel.
const { st } = require('./_lib');
exports.handler = async e => {
  const k = String((e.queryStringParameters || {}).k || '');
  if (!/^[a-z0-9]+\.jpg$/.test(k)) return { statusCode: 400, body: 'x' };
  const ab = await st(e, 'fotos').get(k, { type: 'arrayBuffer' });
  if (!ab) return { statusCode: 404, body: 'x' };
  return { statusCode: 200, isBase64Encoded: true, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }, body: Buffer.from(ab).toString('base64') };
};
