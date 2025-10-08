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
    // Verifikasi HMAC Signature
    const receivedSignature = req.headers['x-scalev-hmac-sha256'];
    const signingSecret = process.env.SCALEV_WEBHOOK_SECRET;
    if (!receivedSignature) { return res.status(401).send('Unauthorized: Signature missing.'); }
    const calculatedSignature = crypto.createHmac('sha256', signingSecret).update(rawBody).digest('base64');
    const areSignaturesEqual = crypto.timingSafeEqual(Buffer.from(receivedSignature, 'base64'), Buffer.from(calculatedSignature, 'base64'));
    if (!areSignaturesEqual) { return res.status(401).send('Unauthorized: Invalid signature.'); }
    
    const { event, data } = body;

    // --- LOGIKA BARU BERDASARKAN EVENT ---

    // 1. Menangani saat order baru dibuat
    if (event === 'order.created') {
      const order_id = data.order_id;
      const customer_email = data.customer ? data.customer.email : null;
      const product_name = data.orderlines && data.orderlines.length > 0 ? data.orderlines[0].product_name : null;

      if (!order_id || !customer_email || product_name !== "Akses FotoGem") {
        console.log('Ignoring order.created event: missing data or not the right product.');
        return res.status(200).send('OK: Event order.created received but not relevant.');
      }

      // Simpan info order ke Firestore untuk diproses nanti saat pembayaran
      const pendingOrderRef = db.collection('pending_orders').doc(order_id);
      await pendingOrderRef.set({
        customerEmail: customer_email,
        productName: product_name,
        createdAt: new Date(),
        status: 'pending'
      });
      
      console.log(`Order ${order_id} for ${customer_email} has been saved as pending.`);
      return res.status(200).send('OK: Pending order logged.');
    }

    // 2. Menangani saat status pembayaran berubah
    if (event === 'order.payment_status_changed' && data.payment_status === 'paid') {
      const order_id = data.order_id;
      if (!order_id) {
        return res.status(400).send('Bad Request: order_id missing in payment event.');
      }

      const pendingOrderRef = db.collection('pending_orders').doc(order_id);
      const orderDoc = await pendingOrderRef.get();

      if (!orderDoc.exists) {
        console.log(`Payment received for order ${order_id}, but no pending order was found. It might have been processed already or is not a FotoGem order.`);
        return res.status(200).send('OK: No pending order found.');
      }

      const { customerEmail } = orderDoc.data();
      const tokensToAdd = 100;

      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', customerEmail).limit(1).get();

      if (snapshot.empty) {
        console.log(`Webhook Error: User not found with email: ${customerEmail}`);
        // Hapus pending order agar tidak menggantung
        await pendingOrderRef.delete();
        return res.status(200).send('OK: User not found, but webhook acknowledged.');
      }

      const userDoc = snapshot.docs[0];
      await userDoc.ref.update({
        tokens: admin.firestore.FieldValue.increment(tokensToAdd)
      });

      // Hapus dokumen dari pending_orders setelah berhasil diproses
      await pendingOrderRef.delete();

      console.log(`Success: Added ${tokensToAdd} tokens to ${customerEmail}`);
      return res.status(200).send('Success: Tokens added.');
    }

    // Jika event bukan salah satu di atas, abaikan.
    return res.status(200).send('OK: Event received but no action taken.');

  } catch (error) {
    console.error("Error processing Scalev webhook:", error);
    return res.status(500).send('Internal Server Error');
  }
};
