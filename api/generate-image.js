// This is a Vercel Serverless Function using CommonJS syntax
const admin = require('firebase-admin');
const sharp = require('sharp'); // Impor library sharp

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

const NEGATIVE_PROMPT = "worst quality, low quality, blurry, pixelated, jpeg artifacts, bad anatomy, extra limbs, missing limbs, broken fingers, asymmetric face, cartoon, 3d, CGI, watermark, text, plastic skin, unnatural lighting, flat lighting, distorted eyes, warped expression, cluttered background, floating objects";

const buildFinalPrompt = (options) => {
    const { style, detectedNiche, useModel, modelOptions, useAdvanced, advancedOptions } = options;
    
    let aspectRatioInstruction = "The final image MUST be a perfectly square 1:1 aspect ratio image.";
    if (useAdvanced && advancedOptions.aspectRatio) {
        switch (advancedOptions.aspectRatio) {
            case "3:4": aspectRatioInstruction = "The final image MUST be a TALL vertical portrait 3:4 aspect ratio image."; break;
            case "4:3": aspectRatioInstruction = "The final image MUST be a WIDE horizontal landscape 4:3 aspect ratio image."; break;
            case "16:9": aspectRatioInstruction = "The final image MUST be a WIDESCREEN horizontal landscape 16:9 aspect ratio image."; break;
        }
    }

    let nicheContext = detectedNiche ? `This product is in the '${detectedNiche}' category. ` : '';
    const globalSuffix = CINEMATIC_OPTICS_REALISM;

    let customPromptContainsLens = false;
    if (useAdvanced && advancedOptions.customPrompt) {
        const lensRegex = /\b(\d{2,3})\s*mm(\s+lens)?\b/i;
        if (lensRegex.test(advancedOptions.customPrompt)) {
            customPromptContainsLens = true;
        }
    }

    let basePrompt = `${aspectRatioInstruction} Now, create one high-quality studio photo, photographed with a Sony Alpha 7R V. Use all uploaded images to understand the product's true shape, color, and texture from all sides, and then render it from the requested perspective. CRUCIAL INSTRUCTION: Do NOT change the product from the original image in any way. Its color, shape, size, texture, and any logos or text must be perfectly preserved. Only change the background, lighting, and environment. ${UNIVERSAL_TEXTURE_REALISM} ${nicheContext}`;
    
    let lensPrompt = customPromptContainsLens ? "" : " with a G Master 85mm F1.4 lens";
    let stylePrompt = "", modelPrompt = "", advancedPrompt = "";

    if (useModel) {
        modelPrompt += " The photo must include a human model. ";
        if (modelOptions.preset !== 'Manual Control') {
            modelPrompt += MODEL_PRESET_PROMPT_MAP[modelOptions.preset] || '';
        } else {
            modelPrompt += ` ${ULTIMATE_SKIN_AND_PHOTO_PROMPT} `;
            if (modelOptions.gender !== 'Auto Detect') modelPrompt += `Gender: ${modelOptions.gender}. `;
            if (modelOptions.age !== 'Random') modelPrompt += `Age: ${modelOptions.age}. `;
            if (modelOptions.ethnicity !== 'Random') modelPrompt += `Ethnicity: ${modelOptions.ethnicity}. `;
            if (modelOptions.skinTone !== 'Random') modelPrompt += `Skin Tone: ${modelOptions.skinTone}. `;
            if (modelOptions.outfit !== 'Random') modelPrompt += `Outfit: ${modelOptions.outfit}. `;
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
        if (advancedOptions.shotType) {
            advancedPrompt += ` The camera perspective is crucial: capture this from a '${advancedOptions.shotType}'.`;
        }
        advancedPrompt += ` Use a '${advancedOptions.shadowStyle}'.`;
        advancedPrompt += ` Prop presence level is '${advancedOptions.propPresence}'.`;
        if (advancedOptions.customPrompt && advancedOptions.customPrompt.trim() !== '') {
            advancedPrompt += ` Additional user instructions: ${advancedOptions.customPrompt}.`;
        }
    }

    if (!useModel) {
        stylePrompt = STYLE_PROMPT_MAP[style] || `The desired style is: "${style}".`;
        if (useAdvanced && advancedOptions.customPrompt && customPromptContainsLens) {
            stylePrompt = stylePrompt.replace(/,?\s*85mm studio lens look/g, '');
        }
    }

    return `${basePrompt}${lensPrompt} ${modelPrompt} ${stylePrompt} ${advancedPrompt} ${globalSuffix}. Negative prompt, avoid the following: ${NEGATIVE_PROMPT}`;
};

// --- Main Handler for the API Endpoint ---
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
  
    let uid;
    try {
        // 1. Otentikasi pengguna dan kurangi token
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) return res.status(401).json({ error: 'Unauthorized: No token provided.' });
        
        const decodedToken = await auth.verifyIdToken(idToken);
        uid = decodedToken.uid;
        
        await db.runTransaction(async (transaction) => {
            const userDocRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists || userDoc.data().tokens < 1) throw new Error('Insufficient tokens');
            transaction.update(userDocRef, { tokens: admin.firestore.FieldValue.increment(-1) });
        });
        
        let { imageParts, options, detectedNiche } = req.body; // Gunakan 'let' agar bisa diubah
        const userDocRefForRefund = db.collection('users').doc(uid);

        if (!imageParts || !options) {
            await userDocRefForRefund.update({ tokens: admin.firestore.FieldValue.increment(1) });
            return res.status(400).json({ error: 'Bad Request: Missing image parts or options.' });
        }
        
        // ======================================================================
        // ▼▼▼ LOGIKA PRE-PROCESSING: MEMPERLUAS KANVAS SEBELUM DIKIRIM KE AI ▼▼▼
        // ======================================================================
        try {
            const targetAspectRatio = (options.useAdvanced && options.advancedOptions.aspectRatio) ? options.advancedOptions.aspectRatio : '1:1';
            const [ratioNum, ratioDen] = targetAspectRatio.split(':').map(Number);
            const requestedRatio = ratioNum / ratioDen;

            // Proses hanya gambar utama (pertama)
            const mainImagePart = imageParts[0];
            const imageBuffer = Buffer.from(mainImagePart.inlineData.data, 'base64');
            
            const metadata = await sharp(imageBuffer).metadata();
            const originalWidth = metadata.width;
            const originalHeight = metadata.height;
            const originalRatio = originalWidth / originalHeight;

            let newCanvasWidth, newCanvasHeight;

            // Tentukan dimensi kanvas baru
            if (originalRatio > requestedRatio) {
                newCanvasWidth = originalWidth;
                newCanvasHeight = Math.round(originalWidth / requestedRatio);
            } else {
                newCanvasHeight = originalHeight;
                newCanvasWidth = Math.round(originalHeight * requestedRatio);
            }

            // Buat kanvas baru dengan latar putih dan tempelkan gambar asli di tengah
            const paddedImageBuffer = await sharp({
                create: {
                    width: newCanvasWidth,
                    height: newCanvasHeight,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                }
            })
            .composite([{
                input: imageBuffer,
                gravity: 'centre' // Letakkan gambar asli di tengah
            }])
            .png() // Konversi ke PNG untuk menjaga transparansi (jika ada)
            .toBuffer();

            // Ganti data gambar asli dengan gambar yang sudah diproses
            imageParts[0].inlineData.data = paddedImageBuffer.toString('base64');
            imageParts[0].inlineData.mimeType = 'image/png';

            console.log(`Success: Input image pre-processed to aspect ratio ${targetAspectRatio}.`);

        } catch (processError) {
            console.error("Error during image pre-processing:", processError);
            // Jika gagal, tetap lanjutkan dengan gambar asli
        }
        // ======================================================================
        // ▲▲▲ AKHIR DARI LOGIKA PRE-PROCESSING ▲▲▲
        // ======================================================================
        
        // 2. Buat prompt dan panggil API Gemini
        const finalPrompt = buildFinalPrompt({ ...options, detectedNiche });
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
        const payload = { 
            contents: [{ parts: [{ text: finalPrompt }, ...imageParts] }], 
            generationConfig: { responseModalities: ['IMAGE'] } 
        };
        
        const geminiResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.json();
            await userDocRefForRefund.update({ tokens: admin.firestore.FieldValue.increment(1) });
            return res.status(500).json({ error: 'Gemini API call failed.', details: errorBody });
        }
        const result = await geminiResponse.json();

        if (result.promptFeedback?.blockReason) {
            await userDocRefForRefund.update({ tokens: admin.firestore.FieldValue.increment(1) });
            return res.status(400).json({ error: `Request blocked by API: ${result.promptFeedback.blockReason}` });
        }

        const base64Data = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        if (!base64Data) {
            await userDocRefForRefund.update({ tokens: admin.firestore.FieldValue.increment(1) });
            return res.status(500).json({ error: 'API did not return valid image data.' });
        }
        
        // 3. Kirim hasil (sudah tidak perlu di-crop)
        res.status(200).json({ base64Data: base64Data });

    } catch (error) {
        console.error("Error processing generate-image request:", error);
        
        if (error.message === 'Insufficient tokens') {
            return res.status(402).json({ error: 'Payment Required: Insufficient tokens.' });
        }
        
        if (uid) {
            const userDocRef = db.collection('users').doc(uid);
            try {
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    await userDocRef.update({ tokens: admin.firestore.FieldValue.increment(1) });
                    console.log(`Token refunded for user ${uid} due to an error.`);
                }
            } catch (refundError) {
                console.error(`Failed to refund token for user ${uid}:`, refundError);
            }
        }
        
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
