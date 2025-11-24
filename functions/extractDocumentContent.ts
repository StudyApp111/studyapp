import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== extractDocumentContent Function Start ===');
    
    let base44, user, file_url;
    
    try {
        base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
    } catch (error) {
        console.error('❌ Failed to create Base44 client:', error.message);
        return Response.json({ error: 'Failed to initialize client', details: error.message }, { status: 500 });
    }

    try {
        user = await base44.auth.me();
        if (!user) {
            console.error('❌ Authentication failed - no user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.log('✅ User authenticated:', user.email);
    } catch (error) {
        console.error('❌ Auth check failed:', error.message);
        return Response.json({ error: 'Authentication error', details: error.message }, { status: 401 });
    }

    try {
        const body = await req.json();
        file_url = body.file_url;
        console.log('✅ Request body parsed, file_url:', file_url);
    } catch (error) {
        console.error('❌ Failed to parse request body:', error.message);
        return Response.json({ error: 'Invalid request body', details: error.message }, { status: 400 });
    }

    try {

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

        // Determine file type for correct API usage
        const contentType = fileResponse.headers.get('content-type') || '';
        const fileName = file_url.split('/').pop().toLowerCase();
        const fileExt = fileName.split('.').pop();
        console.log('📄 File type:', fileExt, 'Content-Type:', contentType);

        const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'heif', 'avif', 'mpo'];
        const documentFormats = ['pdf', 'pptx', 'docx', 'doc', 'ppt'];
        
        const isImage = imageFormats.includes(fileExt);
        const isDocument = documentFormats.includes(fileExt);

        if (!isImage && !isDocument) {
            console.error('❌ Unsupported file format:', fileExt);
            return Response.json({ 
                error: 'Unsupported file format',
                details: `File type .${fileExt} is not supported. Supported formats: ${[...imageFormats, ...documentFormats].join(', ')}`
            }, { status: 400 });
        }

        console.log('✅ File type detected:', isImage ? 'IMAGE' : 'DOCUMENT');

        const prompt = `Extract ALL educational content from this document. Include every detail - text, questions, rubrics, criteria, and instructions. Be extremely thorough and preserve all information verbatim.`;

        // Use document_url for documents (PDF, PPTX, DOCX) and image_url for images
        const contentItem = isDocument ? {
            type: 'document_url',
            document_url: {
                url: file_url
            }
        } : {
            type: 'image_url',
            image_url: {
                url: file_url
            }
        };

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
                        contentItem
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
        console.error('❌ CRITICAL ERROR IN MAIN PROCESSING:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return Response.json({ 
            error: 'Document processing failed',
            message: error.message,
            type: error.name,
            stage: 'main_processing'
        }, { status: 500 });
    }
});