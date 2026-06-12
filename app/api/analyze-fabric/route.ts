import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Smart tagging service is not configured.' }, { status: 500 });
    }

    // 1. Fetch image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to retrieve catalog image: ${imageResponse.statusText}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    const genAI = new GoogleGenerativeAI(apiKey);
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: contentType
      }
    };

    const prompt = `
Analyze this fabric sample photo. Identify the suggested fabric name, dominant color, pattern style, and estimated material/texture. 
Respond strictly with a JSON object matching this structure:
{
  "name": "Suggested Name (e.g. Cobalt Blue Floral Crepe)",
  "color": "Dominant Color (e.g. Cobalt Blue)",
  "pattern": "Pattern type (e.g. Floral, Solid, Striped, Plaid, Houndstooth)",
  "material": "Estimated material/texture (e.g. Crepe Polyester, Woven Cotton, Knit Wool)"
}
`;

    // 2. Query model (with fallback to 1.5 Flash)
    let result;
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3.1-flash-lite',
        generationConfig: { responseMimeType: 'application/json' }
      });
      result = await model.generateContent([prompt, imagePart]);
    } catch (err) {
      console.warn('Default engine unavailable, falling back to backup engine:', err);
      const fallbackModel = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      result = await fallbackModel.generateContent([prompt, imagePart]);
    }

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return NextResponse.json({ suggestions: parsedData });
  } catch (error: any) {
    console.error('Fabric Auto-detect Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to auto-detect fabric properties' }, { status: 500 });
  }
}
