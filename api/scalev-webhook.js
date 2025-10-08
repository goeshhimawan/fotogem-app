// This is a Vercel Serverless Function using CommonJS syntax

const crypto = require('crypto');
const admin = require('firebase-admin');

// ... (kode inisialisasi Firebase tetap sama) ...
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
// ... (kode inisialisasi Firebase tetap sama) ...

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const rawBody = await getRawBody(req);
  const body = JSON.parse(rawBody.toString());

  try {
    // ... (kode verifikasi signature tetap sama) ...
    const receivedSignature = req.headers['x-scalev-hmac-sha256'];
    const signingSecret = process.env.SCALEV_WEBHOOK_SECRET;
    if (!receivedSignature) { return res.status(401).send('Unauthorized: Signature missing.'); }
    const calculatedSignature = crypto.createHmac('sha256', signingSecret).update(rawBody).digest('base64');
    const areSignaturesEqual = crypto.timingSafeEqual(Buffer.from(receivedSignature, 'base64'), Buffer.from(calculatedSignature, 'base64'));
    if (!areSignaturesEqual) { return res.status(401).send('Unauthorized: Invalid signature.'); }
    // ... (kode verifikasi signature tetap sama) ...
    
    const { event, data } = body;

    if (event === "business.test_event") {
      console.log("Received Scalev test event. Responding with 200 OK.");
      return res.status(200).send('OK: Test event received successfully.');
    }

    // --- PERUBAHAN UTAMA ADA DI SINI ---
    const acceptedEvents = ['order.status_changed', 'order.payment_status_changed'];

    // Cek apakah eventnya relevan DAN statusnya 'completed'
    if (!acceptedEvents.includes(event) || data.status !== 'completed') {
        console.log(`Ignoring event "${event}" with status "${data.status}".`);
        return res.status(200).send('OK: Event not relevant.');
    }

    const customer_email = data.customer ? data.customer.email : null;
    const product_name = data.products && data.products.length > 0 ? data.products[0].name : null;

    if (!customer_email || !product_name) {
      console.error("Webhook payload is missing customer email or product name.", data);
      return res.status(400).send('Bad Request: Missing customer_email or product_name in the webhook data object.');
    }

    let tokensToAdd = 0;
    if (product_name === "Akses FotoGem") {
      tokensToAdd = 100;
    } else {
      console.log(`Product "${product_name}" not recognized for token assignment.`);
      return res.status(200).send('OK: Product not relevant for tokens.');
    }

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
