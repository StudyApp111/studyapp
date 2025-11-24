import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== extractDocumentContent Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            console.error('❌ Authentication failed - no user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.log('✅ User authenticated:', user.email);

        const { file_url } = await req.json();

        if (!file_url) {
            console.error('❌ Missing file_url in request');
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }
        console.log('✅ File URL received:', file_url);

        // Check API key
        const apiKey = Deno.env.get("MistralDocumentAIKey");
        if (!apiKey) {
            console.error('❌ CRITICAL: MistralDocumentAIKey not found in environment');
            return Response.json({ 
                error: 'API key not configured',
                details: 'MistralDocumentAIKey secret is missing'
            }, { status: 500 });
        }
        console.log('✅ API key found, length:', apiKey.length);

        // Download file
        console.log('⏳ Downloading file...');
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            console.error('❌ File download failed:', fileResponse.status, fileResponse.statusText);
            return Response.json({ 
                error: 'Failed to download file',
                status: fileResponse.status
            }, { status: 500 });
        }
        console.log('✅ File downloaded successfully');

        const fileBlob = await fileResponse.blob();
        const fileSize = fileBlob.size;
        console.log('📊 File size:', fileSize, 'bytes');

        if (fileSize > 50 * 1024 * 1024) {
            console.error('❌ File too large:', fileSize);
            return Response.json({ 
                error: 'File too large. Please upload files smaller than 50MB.' 
            }, { status: 400 });
        }

        // Determine media type
        const contentType = fileResponse.headers.get('content-type') || '';
        const fileName = file_url.split('/').pop().toLowerCase();
        const fileExt = fileName.split('.').pop();
        console.log('📄 File type:', fileExt, 'Content-Type:', contentType);

        let mediaType = 'application/pdf';
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileExt)) {
            if (fileExt === 'png') mediaType = 'image/png';
            else if (fileExt === 'jpg' || fileExt === 'jpeg') mediaType = 'image/jpeg';
            else if (fileExt === 'webp') mediaType = 'image/webp';
            else if (fileExt === 'gif') mediaType = 'image/gif';
        }
        console.log('✅ Media type:', mediaType);

        // Convert to base64
        console.log('⏳ Converting to base64...');
        const arrayBuffer = await fileBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        const chunkSize = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Data = btoa(binary);
        console.log('✅ Base64 conversion complete, length:', base64Data.length);

        const prompt = `Extract ALL educational content from this document. Include every detail - text, questions, rubrics, criteria, and instructions. Be extremely thorough and preserve all information verbatim.`;

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
                            image_url: {
                                url: `data:${mediaType};base64,${base64Data}`
                            }
                        }
                    ]
                }
            ]
        };

        console.log('⏳ Calling Mistral API...');
        console.log('📤 Request body structure:', {
            model: requestBody.model,
            messages_count: requestBody.messages.length,
            content_items: requestBody.messages[0].content.length
        });

        const chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📥 Mistral API response status:', chatResponse.status, chatResponse.statusText);

        if (!chatResponse.ok) {
            const errorBody = await chatResponse.text();
            console.error('❌ Mistral API error response:', errorBody);
            
            let errorDetails = {
                status: chatResponse.status,
                statusText: chatResponse.statusText,
                body: errorBody
            };

            if (chatResponse.status === 401) {
                console.error('❌ AUTHENTICATION ERROR: API key is invalid or expired');
                return Response.json({ 
                    error: 'Mistral API authentication failed',
                    details: 'Check if MistralDocumentAIKey is correct',
                    mistral_error: errorBody
                }, { status: 500 });
            } else if (chatResponse.status === 400) {
                console.error('❌ BAD REQUEST: Invalid request format');
                return Response.json({ 
                    error: 'Invalid request to Mistral API',
                    details: errorDetails
                }, { status: 500 });
            } else if (chatResponse.status === 429) {
                console.error('❌ RATE LIMIT: Too many requests');
                return Response.json({ 
                    error: 'Rate limit exceeded',
                    details: 'Please try again in a moment'
                }, { status: 500 });
            }

            console.error('❌ UNKNOWN ERROR from Mistral API');
            return Response.json({ 
                error: 'Mistral API request failed',
                details: errorDetails
            }, { status: 500 });
        }

        const chatData = await chatResponse.json();
        console.log('✅ Mistral API response received');
        
        const extractedContent = chatData.choices?.[0]?.message?.content;

        if (!extractedContent || extractedContent.trim().length === 0) {
            console.error('❌ No content extracted from response');
            console.log('Response data:', JSON.stringify(chatData, null, 2));
            return Response.json({ 
                error: 'No content extracted from document',
                details: 'Mistral returned empty content'
            }, { status: 500 });
        }

        console.log('✅ Content extracted successfully, length:', extractedContent.length);
        console.log('=== extractDocumentContent Function Complete ===');

        return Response.json({ 
            extracted_content: extractedContent,
            characters: extractedContent.length,
            file_size: fileSize,
            file_type: mediaType,
            method: 'mistral_pixtral_large'
        });

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return Response.json({ 
            error: 'Internal server error',
            message: error.message,
            type: error.name,
            stack: error.stack
        }, { status: 500 });
    }
});