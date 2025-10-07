// This is a Vercel Serverless Function
// Its only job is to securely provide public keys to the frontend.

export default function handler(req, res) {
  // We only allow GET requests to this endpoint
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Read the keys from Vercel's secure environment variables
    const keys = {
      firebaseApiKey: process.env.VITE_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.VITE_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.VITE_FIREBASE_APP_ID,
      geminiApiKey: process.env.VITE_GEMINI_API_KEY
    };

    // Check if any key is missing (important for debugging)
    for (const [key, value] of Object.entries(keys)) {
      if (!value) {
        // If a key is missing, send an error
        console.error(`Server Error: Environment variable ${key.replace('firebase','VITE_FIREBASE_').replace('gemini','VITE_GEMINI_')} is not set in Vercel.`);
        return res.status(500).json({ error: `Server configuration error: A required key is missing.` });
      }
    }

    // If all keys are present, send them to the frontend
    res.status(200).json(keys);

  } catch (error) {
    console.error('Error in get-keys function:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
