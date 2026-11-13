/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Extensão .ts: o node (ESM) só acha o módulo assim. O tsc do projeto não aceita essa extensão, por isso o nocheck.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  idsDoEndpoint,
  modoPush,
  parseAssinatura,
  trechoEndpoint,
  urlBase64ParaBytes,
  vapidPronto,
  type AmbientePush,
} from './push-web.ts';

const CHAVE_P = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfXRs';
const CHAVE_A = 'tBHItJI5svbpez7KI4CCXg';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/aparelho-um';
const ENDPOINT_2 = 'https://fcm.googleapis.com/fcm/send/aparelho-dois';

function assinatura(endpoint = ENDPOINT, auth = CHAVE_A) {
  return { endpoint, expirationTime: null, keys: { p256dh: CHAVE_P, auth } };
}

function ambiente(parcial: Partial<AmbientePush>): AmbientePush {
  return {
    userAgent: 'Mozilla/5.0',
    maxTouchPoints: 0,
    platform: 'Linux',
    capacitorNativo: false,
    reactNativeWebView: false,
    standalone: false,
    temServiceWorker: true,
    temPushManager: true,
    temNotification: true,
    ...parcial,
  };
}

test('aceita a assinatura e devolve um token estável com o mesmo endpoint', () => {
  const a = parseAssinatura(assinatura());
  const b = parseAssinatura(JSON.stringify(assinatura()));
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.equal(a.token, b.token);
  assert.equal(a.assinatura.endpoint, ENDPOINT);
  assert.equal(JSON.parse(a.token).keys.auth, CHAVE_A);
});

test('rejeita endereço http, chave curta, validade estranha e texto que não é JSON', () => {
  assert.equal(parseAssinatura({ ...assinatura(), endpoint: 'http://inseguro.example/push' }).ok, false);
  assert.equal(parseAssinatura({ ...assinatura(), keys: { p256dh: CHAVE_P, auth: 'curta' } }).ok, false);
  assert.equal(parseAssinatura({ ...assinatura(), expirationTime: 'amanha' }).ok, false);
  assert.equal(parseAssinatura('não é json').ok, false);
  assert.equal(parseAssinatura(null).ok, false);
});

test('deduplica pelo endpoint mesmo quando as chaves mudam', () => {
  const antiga = parseAssinatura(assinatura());
  const nova = parseAssinatura(assinatura(ENDPOINT, 'outraAuthCom16charsXX'));
  const outra = parseAssinatura(assinatura(ENDPOINT_2));
  assert.equal(antiga.ok && nova.ok && outra.ok, true);
  if (!antiga.ok || !nova.ok || !outra.ok) return;
  assert.notEqual(antiga.token, nova.token);
  const ids = idsDoEndpoint(
    [
      { id: 9, token: nova.token },
      { id: 2, token: 'token-nativo-sem-json' },
      { id: 4, token: antiga.token },
      { id: 7, token: outra.token },
      { id: 3, token: JSON.stringify({ endpoint: 'http://inseguro.example/x', keys: assinatura().keys }) },
    ],
    ENDPOINT,
  );
  assert.deepEqual(ids, [4, 9]);
  assert.deepEqual(idsDoEndpoint([{ id: 1, token: outra.token }], 'http://inseguro.example/x'), []);
});

test('o trecho do endpoint cabe dentro do JSON guardado', () => {
  const endpoint = 'https://web.push.apple.com/Qabc_def-123';
  const ok = parseAssinatura(assinatura(endpoint));
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.ok(ok.token.includes(trechoEndpoint(endpoint)));
  assert.equal(trechoEndpoint('https://x.com/a"b'), 'https://x.com/a\\"b');
});

test('vapid só fica pronto com as três variáveis e um mailto', () => {
  const pub = 'B'.repeat(87);
  const priv = 'a'.repeat(40);
  assert.equal(vapidPronto({ publicKey: pub, privateKey: priv, subject: 'mailto:pagamentos@speedupti.com.br' }), true);
  assert.equal(vapidPronto({ publicKey: pub, privateKey: priv, subject: 'https://natalemfamilia.com.br' }), false);
  assert.equal(vapidPronto({ publicKey: '', privateKey: priv, subject: 'mailto:a@b.co' }), false);
  assert.equal(vapidPronto({}), false);
});

test('converte a chave pública base64url', () => {
  assert.deepEqual([...urlBase64ParaBytes('aGVsbG8')!], [...Buffer.from('hello')]);
  assert.equal(urlBase64ParaBytes('***'), null);
  assert.equal(urlBase64ParaBytes(''), null);
});

test('esconde no app nativo, explica no iPhone solto e libera no navegador com push', () => {
  assert.equal(modoPush(ambiente({ capacitorNativo: true })), 'oculto');
  assert.equal(modoPush(ambiente({ reactNativeWebView: true, userAgent: 'iPhone' })), 'oculto');
  assert.equal(modoPush(ambiente({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' })), 'iphone-instalar');
  assert.equal(modoPush(ambiente({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
    standalone: true,
  })), 'pronto');
  assert.equal(modoPush(ambiente({ platform: 'MacIntel', maxTouchPoints: 5 })), 'iphone-instalar');
  assert.equal(modoPush(ambiente({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
    standalone: true,
    temPushManager: false,
  })), 'sem-suporte');
  assert.equal(modoPush(ambiente({})), 'pronto');
  assert.equal(modoPush(ambiente({ temNotification: false })), 'sem-suporte');
});

test('recusa endpoint fora dos serviços de push conhecidos', () => {
  assert.equal(parseAssinatura(assinatura('https://evil.example/push')).ok, false);
  assert.equal(parseAssinatura(assinatura('https://fcm.googleapis.com/fcm/send/abc')).ok, true);
  assert.equal(parseAssinatura(assinatura('https://wns2-bl2p.notify.windows.com/w/?token=x')).ok, true);
});
