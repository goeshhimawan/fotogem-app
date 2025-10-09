// This is a Vercel Serverless Function using CommonJS syntax
const admin = require('firebase-admin');

// --- Initialize Firebase Admin SDK ---
// This is used for secure server-side operations like token validation and database access.
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
const auth = admin.auth();

// --- SECRET PROMPT ENGINEERING LOGIC ---
// This section is now secure on the server and invisible to users.

const ULTIMATE_SKIN_AND_PHOTO_PROMPT = "Create a hyperrealistic professional photograph. Render natural human skin with extreme fidelity. Every micro-detail is crucial: visible pores, fine micro-wrinkles, subtle blemishes, and barely perceptible vellus hair (peach fuzz) must be present. Preserve all natural micro-textures and skin grain, including subtle shadows in skin creases. The skin's coloration must be authentic, showing natural variations and slight, realistic color unevenness. Master the physics of light on skin: highlight its natural diffusion and translucency (subsurface scattering), and render the natural gloss from skin oil. CRUCIAL: Absolutely no airbrushing, smoothing, or artificial blurring. The result must be free of any plastic, doll-like, or CG look. The image should emulate a high-end camera capture: soft photographic grain, a true optical depth of field, balanced exposure tone-mapping, cinematic natural lighting, physically accurate shadow softness, and a filmic color response curve. The final output must be an unretouched, authentic photograph comparable to a high-fashion beauty campaign, use ultra-high-frequency texture synthesis, physically based rendering of skin micro-fibers, and sub-millimeter displacement mapping to reproduce true epidermal irregularities under directional lighting.";
const UNIVERSAL_TEXTURE_REALISM = `Render all materials with physically-based accuracy. For fabrics: resolve visible weave patterns, soft wrinkles, and micro-fiber fuzz under diffused light. For glass or transparent materials: simulate refraction, edge dispersion, smudges, and balanced reflection. For liquids: show correct meniscus curve, droplet specularity, and thin film reflection. For metal: display micro-scratches, brushed texture, and soft highlight falloff. For wood or stone: preserve grain detail, micro roughness, and natural imperfections. For plastic: reproduce subtle surface gloss, edge reflection, and texture fidelity. For hair or fur: maintain directional strand detail with correct light scattering. Ensure realistic subsurface scattering, accurate specular roughness, and micro shadowing. Use physically based rendering (PBR) with high-frequency displacement mapping for all textures.`;
const CINEMATIC_OPTICS_REALISM = `Simulate true optical camera physics: depth-of-field, chromatic aberration, realistic bokeh highlights, lens diffraction at small apertures, and accurate color bleeding between materials. Lighting must behave like a real studio with inverse-square law intensity falloff and soft diffusion shadows.`;

const STYLE_PROMPT_MAP = {
    "Classic Studio": "clean studio light, pure white background, soft shadow, professional product photography, high detail, minimal aesthetic, ultra-detailed textures, controlled reflection, realistic lens focus, 85mm studio lens look, photorealistic material accuracy",
    "Natural Organic": "natural daylight, soft warm tone, wooden surface, linen texture, organic mood, nature inspired, fresh clean style, macro-level fabric texture visibility, realistic daylight falloff, bokeh depth, fine surface imperfections",
    "Luxury Premium": "luxury lighting, black and gold palette, glossy reflection, marble background, elegant cinematic product shot, soft specular highlights, cinematic contrast ratio 1:3, glass/marble reflections rendered with physical accuracy, ultra-clean DOF",
    "Modern Minimal": "modern minimalist studio photography, focusing on the product's form with balanced composition and negative space. Use soft, diffused lighting with subtle shadows. The color palette should be tone-on-tone harmony. No distracting decorations, real photographic depth, true-to-life textures, no CG look, natural imperfections retained",
    "Lifestyle": "in-context lifestyle scene, natural environment, human element optional, real-life usage setup, cozy lighting, environmental lighting matching, soft focus background, depth separation between subject and product, cinematic LUT",
    "Flatlay": "flatlay top view, creative arrangement, shadowless soft light, visual storytelling composition, minimalist props, ultra-sharp lens detail, natural daylight shadow gradient, 50mm macro lens look, crisp textures",
    "Tech Futuristic": "futuristic gradient light, metallic reflection, cyber aesthetic, cool blue tone, modern tech background, photo-based realism, metal micro-scratch detail, volumetric lighting realism, precise exposure balance",
    "Interior": "interior lighting, cozy home setup, wooden furniture, ambient warm tone, natural shadows, high-resolution detail, soft directional window light, realistic reflections, cinematic exposure tone-mapping",
    "Zen & Wellness": "calm zen mood, soft diffused lighting, stone and towel texture, spa environment, peaceful color palette, ultra-fine texture of stone/towel, realistic shadow diffusion, serene daylight realism",
    "Hero Campaign": "cinematic lighting, dramatic spotlight, product hero center, depth of field, studio-grade composition, studio smoke haze realism, volumetric light beam accuracy, ultra-high contrast dynamic range"
};

const MODEL_PRESET_PROMPT_MAP = {
    "Runway Editorial": `full body framing, confident editorial stance, high-contrast soft keylight, model with a strong, assertive expression. ${ULTIMATE_SKIN_AND_PHOTO_PROMPT} 4K fashion photography realism.`,
    "Commercial Lifestyle": `natural casual pose, like a commercial ad, soft natural daylight, model with a friendly, authentic expression, soft daylight tone. ${ULTIMATE_SKIN_AND_PHOTO_PROMPT} Natural dynamic skin lighting.`,
    "Studio Campaign": `formal studio campaign style, professional balanced lighting (key, fill, rim), neutral backdrop, confident and polished model pose. ${ULTIMATE_SKIN_AND_PHOTO_PROMPT} Balanced color grading.`,
    "Dynamic Fashion Shot": `dynamic motion pose, as if walking or turning lightly, with subtle motion blur, cinematic keylight, and a candid expression. ${ULTIMATE_SKIN_AND_PHOTO_PROMPT} Realistic motion captured blur.`,
    "Creative Hero Model": `creative hero shot focusing on the product, with the full-body model in the center of the frame, high-contrast cinematic lighting. ${ULTIMATE_SKIN_AND_PHOTO_PROMPT} Studio smoke, cinematic LUT color accuracy.`
};


// The function to build the final prompt, now running securely on the server.
const buildFinalPrompt = (options) => {
    const {
        style,
        detectedNiche,
        useModel,
        modelOptions,
        useAdvanced,
        advancedOptions
    } = options;

    let nicheContext = detectedNiche ? `This product is in the '${detectedNiche}' category. ` : '';
    const globalSuffix = CINEMATIC_OPTICS_REALISM;
    let basePrompt = `Generate one high-quality studio photo based on multiple reference images of the same product. Use all uploaded images collectively to preserve the true shape, color, texture, and proportions. Combine front, side, and back views coherently into a single consistent perspective. Do not invent new elements. Keep realism intact. CRUCIAL INSTRUCTION: Do NOT change the product from the original image in any way. Its color, shape, size, texture, and any logos or text must be perfectly preserved. Only change the background, lighting, and environment around the product. The final image must have a strict 1:1 square aspect ratio. ${UNIVERSAL_TEXTURE_REALISM} ${nicheContext}`;

    let stylePrompt = "";
    let modelPrompt = "";
    let advancedPrompt = "";

    if (useModel) {
        modelPrompt += " The photo must include a human model. ";
        if (modelOptions.gender !== 'Auto Detect') modelPrompt += `Gender: ${modelOptions.gender}. `;
        if (modelOptions.age !== 'Random') modelPrompt += `Age: ${modelOptions.age}. `;
        if (modelOptions.ethnicity !== 'Random') modelPrompt += `Ethnicity: ${modelOptions.ethnicity}. `;
        if (modelOptions.skinTone !== 'Random') modelPrompt += `Skin Tone: ${modelOptions.skinTone}. `;
        if (modelOptions.outfit !== 'Random') modelPrompt += `Outfit: ${modelOptions.outfit}. `;

        if (modelOptions.preset !== 'Manual Control') {
            modelPrompt += MODEL_PRESET_PROMPT_MAP[modelOptions.preset] || '';
        } else {
            modelPrompt += ` ${ULTIMATE_SKIN_AND_PHOTO_PROMPT} `;
            if (modelOptions.pose !== 'Random') modelPrompt += `Pose: ${modelOptions.pose}. `;
            if (modelOptions.expression !== 'Random') modelPrompt += `Expression: ${modelOptions.expression}. `;
            modelPrompt += `Camera Focus: ${modelOptions.focus}. `;
            modelPrompt += `Makeup: ${modelOptions.makeup}. `;
        }
    }

    if (useAdvanced) {
        advancedPrompt = ` The lighting mood is '${advancedOptions.lightingMood}'.`;
        advancedPrompt += ` The background is a '${advancedOptions.backgroundVariant}' type.`;
        if (['Solid', 'Gradient'].includes(advancedOptions.backgroundVariant)) {
            advancedPrompt += ` The primary color for the background should be around ${advancedOptions.bgColor}.`;
        }
        advancedPrompt += ` The camera composition is a '${advancedOptions.shotType}'.`;
        advancedPrompt += ` Use a '${advancedOptions.shadowStyle}'.`;
        advancedPrompt += ` Prop presence level is '${advancedOptions.propPresence}'.`;
        if (advancedOptions.customPrompt && advancedOptions.customPrompt.trim() !== '') {
            advancedPrompt += ` Additional user instructions: ${advancedOptions.customPrompt}.`;
        }
    } else {
        if (!useModel) {
            stylePrompt = STYLE_PROMPT_MAP[style] || `The desired style is: "${style}".`;
        }
    }
    return `${basePrompt} ${modelPrompt} ${stylePrompt} ${advancedPrompt} ${globalSuffix}`;
};


// --- Main Handler for the API Endpoint ---
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method Not Allowed'
        });
    }
  
    let uid; // Definisikan uid di luar try-catch untuk bisa diakses di blok catch

    try {
        // 1. Authenticate the user
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({
                error: 'Unauthorized: No token provided.'
            });
        }
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2 & 3. Check balance and deduct token using a Transaction
        await db.runTransaction(async (transaction) => {
            const userDocRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userDocRef);

            if (!userDoc.exists || userDoc.data().tokens < 1) {
                // Gunakan throw error untuk membatalkan transaksi
                throw new Error('Insufficient tokens'); 
            }
            
            // Jika token cukup, kurangi token di dalam transaksi yang sama
            transaction.update(userDocRef, { 
                tokens: admin.firestore.FieldValue.increment(-1) 
            });
        });

        // 4. Get data from client request
        const {
            imageParts,
            options,
            detectedNiche
        } = req.body;
        if (!imageParts || !options) {
             // Refund token if request is malformed
            await userDocRef.update({ tokens: admin.firestore.FieldValue.increment(1) });
            return res.status(400).json({ error: 'Bad Request: Missing image parts or options.' });
        }
        
        // 5. Build the final prompt on the server
        const finalPrompt = buildFinalPrompt({ ...options, detectedNiche });
        console.log("Server-Side Final Prompt:", finalPrompt); // For debugging on Vercel logs

        // 6. Call the Gemini API
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{
                parts: [{
                    text: finalPrompt
                }, ...imageParts]
            }],
            generationConfig: {
                responseModalities: ['IMAGE']
            },
        };

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.json();
            console.error("Gemini API Error:", errorBody);
            // Refund token on Gemini API failure
            await userDocRef.update({ tokens: admin.firestore.FieldValue.increment(1) });
            return res.status(500).json({ error: 'Gemini API call failed.', details: errorBody });
        }
        
        const result = await geminiResponse.json();
        
        // 7. Check for safety blocks from Gemini
        if (result.promptFeedback && result.promptFeedback.blockReason) {
             await userDocRef.update({ tokens: admin.firestore.FieldValue.increment(1) }); // Refund token
             return res.status(400).json({ error: `Request blocked by API: ${result.promptFeedback.blockReason}` });
        }

        const base64Data = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        if (!base64Data) {
            await userDocRef.update({ tokens: admin.firestore.FieldValue.increment(1) }); // Refund token
            return res.status(500).json({ error: 'API did not return valid image data.' });
        }

        // 8. Send the successful result back to the client
        res.status(200).json({
            base64Data
        });

        } catch (error) {
            console.error("Error processing generate-image request:", error);
    
            // Jika errornya karena token tidak cukup (dari dalam transaksi)
            if (error.message === 'Insufficient tokens') {
                return res.status(402).json({ error: 'Payment Required: Insufficient tokens.' });
            }
    
            // Refund token jika error terjadi SETELAH transaksi berhasil
            // Kita periksa apakah uid sudah ada
            if (uid) {
                const userDocRef = db.collection('users').doc(uid);
                // Periksa apakah userDocRef ada sebelum mencoba mengupdate
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    await userDocRef.update({ tokens: admin.firestore.FieldValue.increment(1) });
                    console.log(`Token refunded for user ${uid} due to an error.`);
                }
            }
            
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
