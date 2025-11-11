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
            console.error('MistralDocumentAIKey not found in environment');
            return Response.json({ error: 'MistralDocumentAIKey not configured' }, { status: 500 });
        }

        console.log('Starting document extraction for:', file_url);

        // Download the file
        console.log('Step 1: Downloading file...');
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            console.error('File download failed:', fileResponse.status, fileResponse.statusText);
            return Response.json({ 
                error: 'Failed to download file', 
                details: `HTTP ${fileResponse.status}: ${fileResponse.statusText}` 
            }, { status: 500 });
        }

        const fileBlob = await fileResponse.blob();
        const fileSize = fileBlob.size;
        console.log('File downloaded successfully, size:', fileSize, 'bytes');

        // Check file size (Mistral has a limit around 100MB, but let's be conservative)
        if (fileSize > 50 * 1024 * 1024) { // 50MB limit
            console.error('File too large:', fileSize);
            return Response.json({ 
                error: 'File too large. Please upload files smaller than 50MB.' 
            }, { status: 400 });
        }

        // Convert to base64
        console.log('Step 2: Converting to base64...');
        const arrayBuffer = await fileBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);
        console.log('Base64 encoding complete, length:', base64Data.length);

        // Determine content type
        const contentType = fileResponse.headers.get('content-type') || 'application/pdf';
        console.log('Content type:', contentType);

        // Map to Mistral-supported media types
        let mediaType = 'application/pdf';
        if (contentType.includes('png')) {
            mediaType = 'image/png';
        } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            mediaType = 'image/jpeg';
        } else if (contentType.includes('webp')) {
            mediaType = 'image/webp';
        } else if (contentType.includes('gif')) {
            mediaType = 'image/gif';
        }

        console.log('Using media type:', mediaType);

        const prompt = `Extract all educational content from this document. Provide a comprehensive summary including:
- All key concepts, topics, and learning objectives
- Important definitions, formulas, and terminology
- Course structure and organization
- Assessment information and grading criteria
- Examples and case studies
- Any recommended resources or readings

Be thorough and detailed - this will be used to create personalized study materials.`;

        console.log('Step 3: Sending to Mistral API...');

        const requestBody = {
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
            temperature: 0.2,
            max_tokens: 16000
        };

        const chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Mistral API response status:', chatResponse.status);

        if (!chatResponse.ok) {
            const errorText = await chatResponse.text();
            console.error('Mistral API error response:', errorText);
            
            // Try to parse error details
            let errorDetails = errorText;
            try {
                const errorJson = JSON.parse(errorText);
                errorDetails = errorJson.message || errorJson.error || errorText;
            } catch (e) {
                // Keep original error text
            }

            return Response.json({ 
                error: 'Mistral API request failed', 
                details: errorDetails,
                status_code: chatResponse.status
            }, { status: 500 });
        }

        const chatData = await chatResponse.json();
        console.log('Mistral API response received');

        const extractedContent = chatData.choices?.[0]?.message?.content;

        if (!extractedContent) {
            console.error('No content extracted. Full response:', JSON.stringify(chatData, null, 2));
            return Response.json({ 
                error: 'No content extracted from document',
                details: 'The API returned an empty response',
                response: chatData
            }, { status: 500 });
        }

        console.log('Success! Extracted', extractedContent.length, 'characters');

        return Response.json({ 
            extracted_content: extractedContent,
            characters: extractedContent.length,
            file_size: fileSize
        });

    } catch (error) {
        console.error('Fatal error in extractDocumentContent:', error);
        console.error('Error stack:', error.stack);
        
        return Response.json({ 
            error: 'Internal server error',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});