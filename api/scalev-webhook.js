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
  const receivedSecret = req.headers['x-scalev-secret'] || "---SECRET TIDAK DITERIMA---";
  const storedSecret = process.env.SCALEV_WEBHOOK_SECRET || "---SECRET TIDAK DISIMPAN DI VERCEL---";

  // --- KODE DEBUGGING DIMULAI ---
  // Kode ini akan mencetak perbandingan kunci rahasia ke log Vercel Anda
  console.log("========================================");
  console.log("MEMERIKSA KUNCI RAHASIA SCALEV");
  console.log(`Kunci Diterima dari Scalev (5 awal): ${receivedSecret.substring(0, 5)}...`);
  console.log(`Kunci Tersimpan di Vercel (5 awal): ${storedSecret.substring(0, 5)}...`);
  console.log(`Apakah kedua kunci SAMA PERSIS? : ${receivedSecret === storedSecret}`);
  console.log("========================================");
  // --- KODE DEBUGGING SELESAI ---

  // 1. Security Check: Ensure the request comes from Scalev
  if (receivedSecret !== storedSecret) {
    return res.status(401).send('Unauthorized: Invalid secret key.');
  }

  // 2. Ensure it's a POST request
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // 3. Get data from Scalev's request body
    const { customer_email, product_name } = req.body;

    if (!customer_email || !product_name) {
      return res.status(400).send('Bad Request: Missing customer_email or product_name.');
    }

    // 4. Determine how many tokens to add
    let tokensToAdd = 0;
    if (product_name === "Akses FotoGem") {
        tokensToAdd = 100;
    } else {
        console.log(`Product "${product_name}" not recognized for token assignment.`);
        return res.status(200).send('OK: Product not relevant for tokens.');
    }

    // 5. Find the user in Firestore by their email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', customer_email).limit(1).get();

    if (snapshot.empty) {
      console.log(`Webhook Error: User not found with email: ${customer_email}`);
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
```

### Langkah 2: Uji Coba Terakhir

1.  Simpan kode baru di atas ke GitHub. Vercel akan otomatis melakukan **deployment baru**.
2.  Tunggu sampai deployment selesai dan statusnya **Ready**.
3.  Buka tab **Logs** di Vercel.
4.  Buka tab Scalev, lalu klik **Save** untuk memicu error.
5.  **Segera kembali ke tab Logs Vercel.**

Kali ini, Anda akan melihat pesan log baru yang saya buat. Pesan itu akan terlihat seperti ini:

```
========================================
MEMERIKSA KUNCI RAHASIA SCALEV
Kunci Diterima dari Scalev (5 awal): st5Dp...
Kunci Tersimpan di Vercel (5 awal): 12JJS...
Apakah kedua kunci SAMA PERSIS? : false
========================================

