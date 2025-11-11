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

        // Get file content as blob
        const fileBlob = await fileResponse.blob();
        const fileBuffer = await fileBlob.arrayBuffer();
        
        // Determine file type from URL or content type
        const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
        const fileName = file_url.split('/').pop() || 'document';
        
        console.log('File downloaded, size:', fileBuffer.byteLength, 'bytes, type:', contentType);

        // Create form data for Mistral API
        const formData = new FormData();
        formData.append('file', new Blob([fileBuffer], { type: contentType }), fileName);
        formData.append('model', 'pixtral-large-latest');
        formData.append('purpose', 'batch');

        console.log('Uploading to Mistral for processing...');

        // Step 1: Upload file to Mistral
        const uploadResponse = await fetch('https://api.mistral.ai/v1/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Mistral upload error:', errorText);
            return Response.json({ 
                error: 'Failed to upload file to Mistral', 
                details: errorText 
            }, { status: uploadResponse.status });
        }

        const uploadData = await uploadResponse.json();
        const fileId = uploadData.id;
        
        console.log('File uploaded to Mistral with ID:', fileId);

        // Step 2: Create chat completion with the file
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

        const chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
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
                                type: 'document_url',
                                document_url: `mistral://${fileId}`
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
            console.error('Mistral chat completion error:', errorText);
            
            // Try to clean up the uploaded file
            try {
                await fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
            } catch (cleanupError) {
                console.error('Failed to cleanup file:', cleanupError);
            }
            
            return Response.json({ 
                error: 'Failed to process document with Mistral', 
                details: errorText 
            }, { status: chatResponse.status });
        }

        const chatData = await chatResponse.json();
        const extractedContent = chatData.choices?.[0]?.message?.content;

        if (!extractedContent) {
            return Response.json({ 
                error: 'No content extracted from document' 
            }, { status: 500 });
        }

        console.log('Content extracted successfully, length:', extractedContent.length, 'characters');

        // Clean up: Delete the file from Mistral after processing
        try {
            await fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            console.log('Cleaned up file from Mistral');
        } catch (cleanupError) {
            console.error('Failed to cleanup file:', cleanupError);
            // Don't fail the request if cleanup fails
        }

        return Response.json({ 
            extracted_content: extractedContent,
            file_id: fileId,
            characters: extractedContent.length
        });

    } catch (error) {
        console.error('Error in extractDocumentContent:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});