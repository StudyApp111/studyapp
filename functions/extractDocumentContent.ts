import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url } = await req.json();

        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("MistralDocumentAIKey");
        if (!apiKey) {
            return Response.json({ error: 'MistralDocumentAIKey not configured' }, { status: 500 });
        }

        console.log('Fetching file from URL:', file_url);

        // Download the file from the URL
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            return Response.json({ 
                error: 'Failed to download file', 
                details: `HTTP ${fileResponse.status}` 
            }, { status: 500 });
        }

        // Get file content as base64
        const fileBlob = await fileResponse.blob();
        const fileBuffer = await fileBlob.arrayBuffer();
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
        
        // Determine file type from URL or content type
        const contentType = fileResponse.headers.get('content-type') || 'application/pdf';
        
        console.log('File downloaded, size:', fileBuffer.byteLength, 'bytes, type:', contentType);

        // Determine media type for Mistral
        let mediaType = 'image/jpeg';
        if (contentType.includes('pdf')) {
            mediaType = 'application/pdf';
        } else if (contentType.includes('png')) {
            mediaType = 'image/png';
        } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            mediaType = 'image/jpeg';
        } else if (contentType.includes('webp')) {
            mediaType = 'image/webp';
        }

        const prompt = `You are an expert educational content analyzer. Extract and provide a detailed, comprehensive transcript or summary of all educational content from this document. 

Your task:
1. Capture ALL key concepts, topics, formulas, definitions, and learning materials
2. Maintain the structure and organization of the content
3. Include any important details like:
   - Learning objectives and outcomes
   - Core topics and subtopics
   - Key terms and definitions
   - Important formulas or equations
   - Examples and case studies
   - Assessment criteria or rubrics
4. Format the output as clear, structured text that preserves the educational value

Be thorough and comprehensive - this content will be used to create personalized learning materials for students.`;

        console.log('Sending to Mistral Pixtral for processing...');

        // Use Pixtral directly with base64 encoded file
        const chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'pixtral-12b-2409',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: `data:${mediaType};base64,${base64Data}`
                            }
                        ]
                    }
                ],
                temperature: 0.3,
                max_tokens: 16000
            })
        });

        if (!chatResponse.ok) {
            const errorText = await chatResponse.text();
            console.error('Mistral API error:', errorText);
            return Response.json({ 
                error: 'Failed to process document with Mistral', 
                details: errorText,
                status: chatResponse.status
            }, { status: chatResponse.status });
        }

        const chatData = await chatResponse.json();
        const extractedContent = chatData.choices?.[0]?.message?.content;

        if (!extractedContent) {
            console.error('No content in response:', chatData);
            return Response.json({ 
                error: 'No content extracted from document',
                details: chatData
            }, { status: 500 });
        }

        console.log('Content extracted successfully, length:', extractedContent.length, 'characters');

        return Response.json({ 
            extracted_content: extractedContent,
            characters: extractedContent.length
        });

    } catch (error) {
        console.error('Error in extractDocumentContent:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});