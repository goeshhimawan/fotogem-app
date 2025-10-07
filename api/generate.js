// Vercel Serverless Function
// File ini akan menjadi "asisten" backend Anda.
// Dia menerima permintaan dari aplikasi Anda, menggunakan API key rahasia,
// dan dengan aman menghubungi Google AI.

export default async function handler(req, res) {
    // 1. Hanya izinkan metode POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 2. Ambil data (prompt dan gambar) yang dikirim dari aplikasi Anda
        const { userPrompt, mainImage } = req.body;

        if (!userPrompt || !mainImage || !mainImage.mimeType || !mainImage.base64) {
            return res.status(400).json({ error: 'Missing required fields in request body.' });
        }

        // 3. Ambil API Key RAHASIA dari Vercel Environment Variables
        // Ini adalah bagian terpenting untuk keamanan. Kunci tidak ada di dalam kode.
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            // Jika Anda lupa mengatur Environment Variable di Vercel
            console.error("GEMINI_API_KEY environment variable not set.");
            return res.status(500).json({ error: "API key is not configured on the server." });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
        
        // 4. Siapkan payload untuk dikirim ke Google AI
        const payload = {
            contents: [{
                parts: [
                    { text: userPrompt },
                    { inlineData: { mimeType: mainImage.mimeType, data: mainImage.base64 } }
                ]
            }],
            generationConfig: {
                responseModalities: ['IMAGE']
            },
        };

        // 5. Kirim permintaan ke Google AI dari server
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (!response.ok) {
            console.error("Google AI API Error:", result);
            const errorMessage = result.error?.message || "An unknown error occurred with the AI service.";
            return res.status(response.status).json({ error: errorMessage });
        }
        
        // 6. Kirim hasilnya kembali ke aplikasi Anda di browser
        res.status(200).json(result);

    } catch (error) {
        console.error('Error in proxy function:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
}
