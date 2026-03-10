import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
    try {
        const apiKey = Deno.env.get("GEMINIAPIKEY");
        const genAI = new GoogleGenerativeAI(apiKey);
        
        const researchModel = genAI.getGenerativeModel({ 
            model: 'gemini-flash-latest', 
            tools: [{ googleSearch: {} }]
        });
        
        const researchResult = await researchModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Hello" }] }]
        });
        
        return Response.json({ success: true, text: researchResult.response.text() });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});