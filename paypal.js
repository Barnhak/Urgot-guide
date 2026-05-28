const router = require('express').Router();
const fetch  = require('node-fetch');
const { Users } = require('../db');

const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
  ? 'https://api.paypal.com'
  : 'https://api.sandbox.paypal.com';

// ── Obtenir un token d'accès PayPal ─────────────────────────────────────────
async function getPaypalToken() {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  return data.access_token;
}

// ── Vérifier un abonnement PayPal ───────────────────────────────────────────
async function getSubscription(subscriptionId) {
  const token = await getPaypalToken();
  const res   = await fetch(
    `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return res.json();
}

// ── Activation après paiement (appelé depuis le frontend) ───────────────────
// Le client envoie son subscriptionId après validation PayPal
router.post('/activate', async (req, res) => {
  const { subscriptionId } = req.body;
  const token = req.cookies?.token;

  if (!token)
    return res.status(401).json({ error: 'Non authentifié.' });

  const jwt = require('jsonwebtoken');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Session expirée.' });
  }

  if (!subscriptionId)
    return res.status(400).json({ error: 'subscriptionId manquant.' });

  // Vérifier auprès de PayPal que l'abo est bien actif
  let sub;
  try {
    sub = await getSubscription(subscriptionId);
  } catch (e) {
    console.error('PayPal API error:', e);
    return res.status(502).json({ error: 'Impossible de vérifier l\'abonnement PayPal.' });
  }

  if (sub.status !== 'ACTIVE')
    return res.status(400).json({ error: `Abonnement non actif (statut: ${sub.status}).` });

  // Récupérer l'email de l'abonné depuis la réponse PayPal
  const paypalEmail  = sub.subscriber?.email_address;
  const nextBilling  = sub.billing_info?.next_billing_time || null;

  // Activer en DB
  const { Users } = require('../db');
  Users.activateSubscription.run(subscriptionId, nextBilling, /* email du user */ '');

  // On utilise l'userId du JWT pour retrouver le user
  const { db } = require('../db');
  db.prepare(
    `UPDATE users
     SET sub_status = 'active', paypal_sub_id = ?, sub_started_at = datetime('now'), sub_expires_at = ?
     WHERE id = ?`
  ).run(subscriptionId, nextBilling, payload.userId);

  console.log(`✅ Abonnement activé — userId ${payload.userId} — subId ${subscriptionId}`);
  res.json({ success: true, redirect: '/guide' });
});

// ── Webhook PayPal ───────────────────────────────────────────────────────────
// À enregistrer dans le dashboard PayPal Developer :
// URL : https://urgot-guide-production.up.railway.app/api/paypal/webhook
router.post('/webhook', async (req, res) => {
  // Vérification de la signature PayPal
  const isValid = await verifyWebhookSignature(req);
  if (!isValid) {
    console.warn('⚠️  Webhook PayPal — signature invalide');
    return res.status(400).json({ error: 'Signature invalide' });
  }

  const event = req.body;
  const subId  = event.resource?.id || event.resource?.billing_agreement_id;

  console.log(`📦 PayPal webhook: ${event.event_type} — subId: ${subId}`);

  switch (event.event_type) {

    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'BILLING.SUBSCRIPTION.RENEWED': {
      const nextBilling = event.resource?.billing_info?.next_billing_time || null;
      Users.updateSubStatus.run('active', nextBilling, subId);
      console.log(`✅ Abo ${subId} actif/renouvelé jusqu'au ${nextBilling}`);
      break;
    }

    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      // On garde l'accès jusqu'à sub_expires_at (déjà en DB), on met juste le statut
      const { db } = require('../db');
      db.prepare(
        `UPDATE users SET sub_status = 'cancelled' WHERE paypal_sub_id = ?`
      ).run(subId);
      console.log(`🚫 Abo ${subId} annulé`);
      break;
    }

    case 'BILLING.SUBSCRIPTION.SUSPENDED':
    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
      Users.updateSubStatus.run('suspended', null, subId);
      console.log(`⏸️  Abo ${subId} suspendu/paiement échoué`);
      break;
    }
  }

  res.sendStatus(200);
});

// ── Vérification de signature webhook PayPal ─────────────────────────────────
async function verifyWebhookSignature(req) {
  try {
    const token = await getPaypalToken();
    const res   = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        auth_algo:         req.headers['paypal-auth-algo'],
        cert_url:          req.headers['paypal-cert-url'],
        transmission_id:   req.headers['paypal-transmission-id'],
        transmission_sig:  req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id:        process.env.PAYPAL_WEBHOOK_ID,
        webhook_event:     req.body,
      }),
    });
    const data = await res.json();
    return data.verification_status === 'SUCCESS';
  } catch (e) {
    console.error('Erreur vérification webhook:', e);
    return false;
  }
}

module.exports = router;
