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
            return Response.json({ error: 'API key not configured' }, { status: 500 });
        }

        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            return Response.json({ 
                error: 'Failed to download file'
            }, { status: 500 });
        }

        const fileBlob = await fileResponse.blob();
        const fileSize = fileBlob.size;

        if (fileSize > 50 * 1024 * 1024) {
            return Response.json({ 
                error: 'File too large. Please upload files smaller than 50MB.' 
            }, { status: 400 });
        }

        const contentType = fileResponse.headers.get('content-type') || '';
        const fileName = file_url.split('/').pop().toLowerCase();
        const fileExt = fileName.split('.').pop();

        let mediaType = 'application/pdf';
        let useVisionModel = false;

        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileExt) || 
            contentType.includes('image/')) {
            useVisionModel = true;
            if (contentType.includes('png') || fileExt === 'png') {
                mediaType = 'image/png';
            } else if (contentType.includes('jpeg') || contentType.includes('jpg') || fileExt === 'jpg' || fileExt === 'jpeg') {
                mediaType = 'image/jpeg';
            } else if (contentType.includes('webp') || fileExt === 'webp') {
                mediaType = 'image/webp';
            } else if (contentType.includes('gif') || fileExt === 'gif') {
                mediaType = 'image/gif';
            }
        }
        else if (fileExt === 'pdf' || contentType.includes('pdf')) {
            mediaType = 'application/pdf';
            useVisionModel = true;
        }
        else if (fileExt === 'docx' || contentType.includes('wordprocessingml')) {
            mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            useVisionModel = true;
        }
        else if (fileExt === 'doc' || contentType.includes('msword')) {
            mediaType = 'application/msword';
            useVisionModel = true;
        }
        else if (fileExt === 'pptx' || contentType.includes('presentationml')) {
            mediaType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            useVisionModel = true;
        }
        else if (fileExt === 'ppt' || contentType.includes('ms-powerpoint')) {
            mediaType = 'application/vnd.ms-powerpoint';
            useVisionModel = true;
        }
        else {
            mediaType = 'application/pdf';
            useVisionModel = true;
        }

        let base64Data;
        try {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            
            const chunkSize = 8192;
            let binary = '';
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
                binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            base64Data = btoa(binary);
        } catch (encError) {
            console.error('Base64 encoding error:', encError.message);
            return Response.json({ 
                error: 'Failed to process file content'
            }, { status: 500 });
        }

        const prompt = `Extract ALL educational content from this document with maximum detail and comprehensiveness. Your extraction should include:

📚 COURSE INFORMATION:
- Course name, code, and description
- Instructor information and contact details
- Course objectives and learning outcomes
- Prerequisites and requirements

📖 CONTENT STRUCTURE:
- All chapters, sections, and subsections with their titles
- Topic outlines and hierarchical organization
- Week-by-week or unit-by-unit breakdown
- Reading assignments and page numbers

🔑 KEY CONCEPTS & MATERIAL:
- All definitions, terminology, and vocabulary
- Formulas, equations, and mathematical expressions
- Theories, principles, and frameworks
- Important facts, dates, and figures
- Examples, case studies, and applications
- Diagrams, charts, and visual content descriptions

📝 ASSESSMENT INFORMATION:
- Grading criteria and rubrics
- Assignment descriptions and requirements
- Test/exam formats and sample questions
- Project guidelines and expectations
- Participation and attendance policies

📚 RESOURCES & REFERENCES:
- Textbook information (title, author, edition, ISBN)
- Required and recommended readings
- Supplementary materials and resources
- External links and online resources

⚠️ IMPORTANT NOTES:
- Capture ALL text including headers, footers, and side notes
- Include page numbers and section references where visible
- Preserve the logical flow and organization of content
- Note any handwritten annotations or highlights
- For images: describe all diagrams, charts, graphs in detail
- For presentations: capture all slide content including speaker notes
- For assignments: include all questions, prompts, and instructions

Be extremely thorough - this content will be used to create personalized study materials and assessments. Do not skip or summarize - extract everything verbatim where possible.`;

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
            temperature: 0.1,
            max_tokens: 16000
        };

        let chatResponse;
        try {
            chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });
        } catch (fetchError) {
            console.error('Mistral API fetch error:', fetchError.message);
            return Response.json({ 
                error: 'Failed to connect to AI service'
            }, { status: 500 });
        }

        if (!chatResponse.ok) {
            const errorText = await chatResponse.text();
            console.error('Mistral API error:', chatResponse.status, errorText);
            
            let errorDetails = 'Document extraction failed';
            
            if (chatResponse.status === 401) {
                errorDetails = 'Authentication failed - API key invalid';
            } else if (chatResponse.status === 400) {
                errorDetails = 'Invalid file format or request';
            } else if (chatResponse.status === 413) {
                errorDetails = 'File too large for processing';
            } else if (chatResponse.status === 415) {
                errorDetails = 'Unsupported file type';
            } else if (chatResponse.status === 429) {
                errorDetails = 'Rate limit exceeded - please try again in a moment';
            }

            return Response.json({ 
                error: errorDetails
            }, { status: 500 });
        }

        const chatData = await chatResponse.json();
        const extractedContent = chatData.choices?.[0]?.message?.content;

        if (!extractedContent || extractedContent.trim().length === 0) {
            return Response.json({ 
                error: 'No content extracted from document'
            }, { status: 500 });
        }

        return Response.json({ 
            extracted_content: extractedContent,
            characters: extractedContent.length,
            file_size: fileSize,
            file_type: mediaType,
            method: 'mistral_pixtral_large'
        });

    } catch (error) {
        console.error('Extract document error:', error.message, error.stack);
        return Response.json({ 
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
});