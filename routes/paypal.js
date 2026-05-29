const router = require('express').Router();
const fetch  = require('node-fetch');
const jwt    = require('jsonwebtoken');
const { Users, pool } = require('../db');

const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
  ? 'https://api.paypal.com'
  : 'https://api.sandbox.paypal.com';

async function getPaypalToken() {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

async function getSubscription(subscriptionId) {
  const token = await getPaypalToken();
  const res   = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

router.post('/activate', async (req, res) => {
  const { subscriptionId } = req.body;
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });

  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Session expirée.' }); }

  if (!subscriptionId)
    return res.status(400).json({ error: 'subscriptionId manquant.' });

  let sub;
  try { sub = await getSubscription(subscriptionId); }
  catch(e) { return res.status(502).json({ error: 'Impossible de vérifier PayPal.' }); }

  if (sub.status !== 'ACTIVE')
    return res.status(400).json({ error: `Abonnement non actif (statut: ${sub.status}).` });

  const nextBilling = sub.billing_info?.next_billing_time || null;

  await pool.query(`
    UPDATE users
    SET sub_status     = 'active',
        paypal_sub_id  = $1,
        sub_started_at = NOW(),
        sub_expires_at = $2
    WHERE id = $3
  `, [subscriptionId, nextBilling, payload.userId]);

  console.log(`✅ Abonnement activé — userId ${payload.userId}`);
  res.json({ success: true, redirect: '/guide' });
});

router.post('/webhook', async (req, res) => {
  const isValid = await verifyWebhookSignature(req);
  if (!isValid) {
    console.warn('⚠️  Webhook PayPal — signature invalide');
    return res.status(400).json({ error: 'Signature invalide' });
  }
  const event = req.body;
  const subId = event.resource?.id || event.resource?.billing_agreement_id;
  console.log(`📦 PayPal webhook: ${event.event_type} — subId: ${subId}`);

  switch (event.event_type) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'BILLING.SUBSCRIPTION.RENEWED': {
      const nextBilling = event.resource?.billing_info?.next_billing_time || null;
      await pool.query("UPDATE users SET sub_status='active', sub_expires_at=$1 WHERE paypal_sub_id=$2", [nextBilling, subId]);
      break;
    }
    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      await pool.query("UPDATE users SET sub_status='cancelled' WHERE paypal_sub_id=$1", [subId]);
      break;
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
      await pool.query("UPDATE users SET sub_status='suspended', sub_expires_at=NULL WHERE paypal_sub_id=$1", [subId]);
      break;
  }
  res.sendStatus(200);
});

async function verifyWebhookSignature(req) {
  try {
    const token = await getPaypalToken();
    const res   = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
  } catch { return false; }
}

module.exports = router;
