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

        console.log('=== Starting Document Extraction ===');
        console.log('File URL:', file_url);
        console.log('API Key present:', !!apiKey);
        console.log('API Key length:', apiKey?.length);

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
        console.log('✓ File downloaded successfully');
        console.log('File size:', fileSize, 'bytes (', (fileSize / 1024 / 1024).toFixed(2), 'MB)');

        // Check file size
        if (fileSize > 50 * 1024 * 1024) {
            console.error('File too large:', fileSize);
            return Response.json({ 
                error: 'File too large. Please upload files smaller than 50MB.' 
            }, { status: 400 });
        }

        // Determine content type
        const contentType = fileResponse.headers.get('content-type') || '';
        console.log('Content type:', contentType);

        const isPDF = contentType.includes('pdf') || file_url.toLowerCase().endsWith('.pdf');
        console.log('Is PDF:', isPDF);

        let extractedContent = '';

        // Strategy 1: For PDFs, try text extraction first (simpler, faster)
        if (isPDF) {
            console.log('Strategy: PDF detected - trying direct text extraction');
            
            try {
                // Use Base44's built-in LLM with file support for PDFs
                console.log('Using Base44 LLM for PDF extraction...');
                const pdfResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: `Extract all educational content from this PDF document. Provide a comprehensive summary including:
- All key concepts, topics, and learning objectives
- Important definitions, formulas, and terminology  
- Course structure and organization
- Assessment information and grading criteria
- Examples and case studies
- Any recommended resources or readings

Be thorough and detailed - this will be used to create personalized study materials.`,
                    file_urls: [file_url]
                });

                extractedContent = pdfResult;
                console.log('✓ PDF content extracted successfully using Base44 LLM');
                console.log('Extracted content length:', extractedContent.length, 'characters');

                return Response.json({ 
                    extracted_content: extractedContent,
                    characters: extractedContent.length,
                    file_size: fileSize,
                    method: 'base44_llm'
                });

            } catch (pdfError) {
                console.error('PDF extraction with Base44 failed:', pdfError);
                console.log('Falling back to Mistral vision model...');
            }
        }

        // Strategy 2: Use Mistral Vision API for images or as fallback
        console.log('Step 2: Converting to base64...');
        const arrayBuffer = await fileBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // More efficient base64 encoding for large files
        const chunkSize = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Data = btoa(binary);
        console.log('✓ Base64 encoding complete');
        console.log('Base64 length:', base64Data.length);

        // Map to supported media types
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

        // Mistral vision prompt
        const prompt = `Extract all educational content from this document. Provide a comprehensive summary including:
- All key concepts, topics, and learning objectives
- Important definitions, formulas, and terminology
- Course structure and organization
- Assessment information and grading criteria
- Examples and case studies
- Any recommended resources or readings

Be thorough and detailed - this will be used to create personalized study materials.`;

        console.log('Step 3: Calling Mistral Vision API...');
        
        const requestBody = {
            model: 'pixtral-large-latest',
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

        console.log('Request body size:', JSON.stringify(requestBody).length, 'bytes');
        console.log('Using model: pixtral-large-latest');

        const chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Mistral API response status:', chatResponse.status);
        console.log('Response headers:', Object.fromEntries(chatResponse.headers.entries()));

        if (!chatResponse.ok) {
            const errorText = await chatResponse.text();
            console.error('=== MISTRAL API ERROR ===');
            console.error('Status:', chatResponse.status);
            console.error('Response:', errorText);
            
            let errorDetails = 'Unknown error';
            try {
                const errorJson = JSON.parse(errorText);
                errorDetails = errorJson.message || errorJson.error || JSON.stringify(errorJson);
                console.error('Parsed error:', errorJson);
            } catch (e) {
                errorDetails = errorText;
            }

            // Provide specific error messages
            if (chatResponse.status === 401) {
                errorDetails = 'Authentication failed. Please check your Mistral API key.';
            } else if (chatResponse.status === 400) {
                errorDetails = 'Invalid request format. The file might be corrupted or unsupported.';
            } else if (chatResponse.status === 413) {
                errorDetails = 'File or request too large for Mistral API.';
            }

            return Response.json({ 
                error: 'Mistral API request failed', 
                details: errorDetails,
                status_code: chatResponse.status,
                mistral_error: errorText
            }, { status: 500 });
        }

        const chatData = await chatResponse.json();
        console.log('✓ Mistral API response received');
        console.log('Response structure:', Object.keys(chatData));

        extractedContent = chatData.choices?.[0]?.message?.content;

        if (!extractedContent) {
            console.error('=== NO CONTENT IN RESPONSE ===');
            console.error('Full response:', JSON.stringify(chatData, null, 2));
            return Response.json({ 
                error: 'No content extracted from document',
                details: 'The API returned an empty response',
                response_preview: JSON.stringify(chatData).substring(0, 500)
            }, { status: 500 });
        }

        console.log('=== SUCCESS ===');
        console.log('Extracted content length:', extractedContent.length, 'characters');
        console.log('First 200 chars:', extractedContent.substring(0, 200));

        return Response.json({ 
            extracted_content: extractedContent,
            characters: extractedContent.length,
            file_size: fileSize,
            method: 'mistral_vision'
        });

    } catch (error) {
        console.error('=== FATAL ERROR ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return Response.json({ 
            error: 'Internal server error',
            message: error.message,
            type: error.constructor.name,
            stack: error.stack
        }, { status: 500 });
    }
});