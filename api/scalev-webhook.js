// This is a Vercel Serverless Function using CommonJS syntax
const crypto = require('crypto');
const admin = require('firebase-admin');

const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}
const db = admin.firestore();

export const config = { api: { bodyParser: false } };

const getRawBody = (req) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const rawBody = await getRawBody(req);
  const body = JSON.parse(rawBody.toString());

  try {
    const receivedSignature = req.headers['x-scalev-hmac-sha256'];
    const signingSecret = process.env.SCALEV_WEBHOOK_SECRET;
    if (!receivedSignature) { return res.status(401).send('Unauthorized: Signature missing.'); }
    const calculatedSignature = crypto.createHmac('sha256', signingSecret).update(rawBody).digest('base64');
    const areSignaturesEqual = crypto.timingSafeEqual(Buffer.from(receivedSignature, 'base64'), Buffer.from(calculatedSignature, 'base64'));
    if (!areSignaturesEqual) { return res.status(401).send('Unauthorized: Invalid signature.'); }
    
    const { event, data } = body;

    if (event === "business.test_event") {
      console.log("Received Scalev test event. Responding with 200 OK.");
      return res.status(200).send('OK: Test event received successfully.');
    }

    // --- PERUBAHAN FINAL ADA DI SINI ---
    const acceptedEvents = ['order.status_changed', 'order.payment_status_changed'];

    // 1. Menggunakan 'data.payment_status' dan mengecek 'paid'
    if (!acceptedEvents.includes(event) || data.payment_status !== 'paid') {
        console.log(`Ignoring event "${event}" with payment_status "${data.payment_status}".`);
        return res.status(200).send('OK: Event not relevant.');
    }

    // 2. Mengambil email dari lokasi yang benar
    const customer_email = data.payment_status_history && data.payment_status_history.length > 0 
      ? data.payment_status_history[0].by.email 
      : null;

    // Cek apakah email ditemukan
    if (!customer_email) {
      console.error("Could not find customer email in the webhook payload.", data);
      return res.status(400).send('Bad Request: Customer email not found in payload.');
    }

    // 3. Menghapus pengecekan nama produk dan langsung set token
    const tokensToAdd = 100;

    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', customer_email).limit(1).get();

    if (snapshot.empty) {
      console.log(`Webhook Error: User not found with email: ${customer_email}`);
      return res.status(200).send('OK: User not found, but webhook acknowledged.');
    }

    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      tokens: admin.firestore.FieldValue.increment(tokensToAdd)
    });

    console.log(`Success: Added ${tokensToAdd} tokens to ${customer_email}`);
    return res.status(200).send('Success: Tokens added.');

  } catch (error) {
    console.error("Error processing Scalev webhook:", error);
    return res.status(500).send('Internal Server Error');
  }
};
