// This is a Vercel Serverless Function
// Vercel will automatically run this code when someone accesses /api/scalev-webhook

// Import Firebase Admin SDK
import admin from 'firebase-admin';

// This is the crucial fix:
// We take the raw private key string from the environment variable
// and manually replace the literal '\\n' characters with actual newline characters '\n'.
// This ensures the key is in the correct PEM format that Firebase expects.
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Initialize Firebase Admin SDK
// Vercel Environment Variables will be used for credentials
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Use the newly formatted private key
      privateKey: privateKey,
    }),
  });
}

const db = admin.firestore();

// The main function that handles requests
export default async function handler(req, res) {
  // 1. Security Check: Ensure the request comes from Scalev
  // We use a "secret key" that you set in both Vercel and Scalev
  const scalevSecret = req.headers['x-scalev-secret'];
  if (scalevSecret !== process.env.SCALEV_WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized: Invalid secret key.');
  }

  // 2. Ensure it's a POST request
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // 3. Get data from Scalev's request body
    // IMPORTANT: Check Scalev's documentation for the actual payload structure.
    // This is an example based on your product.
    const { customer_email, product_name } = req.body;

    if (!customer_email || !product_name) {
      return res.status(400).send('Bad Request: Missing customer_email or product_name.');
    }

    // 4. Determine how many tokens to add
    let tokensToAdd = 0;
    if (product_name === "Akses FotoGem") {
        tokensToAdd = 100;
    } else {
        // You can add more products here later
        console.log(`Product "${product_name}" not recognized for token assignment.`);
        return res.status(200).send('OK: Product not relevant for tokens.');
    }

    // 5. Find the user in Firestore by their email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', customer_email).limit(1).get();

    if (snapshot.empty) {
      console.log(`Webhook Error: User not found with email: ${customer_email}`);
      // Return 200 OK so Scalev doesn't retry. The issue is on the user's side (e.g., typo in email).
      return res.status(200).send('OK: User not found, but webhook acknowledged.');
    }

    // 6. Update the user's token count
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
}

