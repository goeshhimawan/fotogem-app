// This is a Vercel Serverless Function using CommonJS syntax

// Import Node.js built-in crypto module for verification
const crypto = require('crypto');
// Import Firebase Admin SDK using require
const admin = require('firebase-admin');

// This is the crucial fix for the private key format
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Initialize Firebase Admin SDK if it hasn't been already
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

// Vercel's default body parser needs to be disabled for raw body access
export const config = {
  api: {
    bodyParser: false,
  },
};

// Function to read the raw body from the request
const getRawBody = (req) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
};

// The main function that handles requests, exported using module.exports
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const rawBody = await getRawBody(req);
  const body = JSON.parse(rawBody.toString());

  try {
    // --- NEW HMAC-SHA256 VERIFICATION BASED ON DOCUMENTATION ---
    const receivedSignature = req.headers['x-scalev-hmac-sha256'];
    const signingSecret = process.env.SCALEV_WEBHOOK_SECRET;

    if (!receivedSignature) {
        return res.status(401).send('Unauthorized: Signature missing.');
    }
      
    // Calculate our own signature
    const calculatedSignature = crypto
      .createHmac('sha256', signingSecret)
      .update(rawBody)
      .digest('base64');
      
    // Securely compare the two signatures
    const areSignaturesEqual = crypto.timingSafeEqual(
        Buffer.from(receivedSignature, 'base64'),
        Buffer.from(calculatedSignature, 'base64')
    );

    if (!areSignaturesEqual) {
      return res.status(401).send('Unauthorized: Invalid signature.');
    }
    // --- END OF NEW VERIFICATION ---
    
    const { event, customer_email, product_name } = body;

    // Handle the initial test event from Scalev
    if (event === "business.test_event") {
      console.log("Received Scalev test event. Responding with 200 OK.");
      return res.status(200).send('OK: Test event received successfully.');
    }

    // Handle actual order events
    if (!customer_email || !product_name) {
      return res.status(400).send('Bad Request: Missing customer_email or product_name for an order event.');
    }

    // Determine how many tokens to add
    let tokensToAdd = 0;
    if (product_name === "Akses FotoGem") {
      tokensToAdd = 100;
    } else {
      console.log(`Product "${product_name}" not recognized for token assignment.`);
      return res.status(200).send('OK: Product not relevant for tokens.');
    }

    // Find the user in Firestore by their email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', customer_email).limit(1).get();

    if (snapshot.empty) {
      console.log(`Webhook Error: User not found with email: ${customer_email}`);
      return res.status(200).send('OK: User not found, but webhook acknowledged.');
    }

    // Update the user's token count
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      tokens: admin.firestore.FieldValue.increment(tokensToAdd)
    });

    console.log(`Success: Added ${tokensToAdd} tokens to ${customer_email}`);
    return res.status(200).send('Success: Tokens added.');

  } catch (error) {
    console.error("Error processing Scalev webhook:", error);
    // Be careful not to expose detailed errors in production
    return res.status(500).send('Internal Server Error');
  }
};

