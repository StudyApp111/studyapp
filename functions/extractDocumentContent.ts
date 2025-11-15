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

        // Check file size limit (50MB)
        if (fileSize > 50 * 1024 * 1024) {
            console.error('File too large:', fileSize);
            return Response.json({ 
                error: 'File too large. Please upload files smaller than 50MB.' 
            }, { status: 400 });
        }

        // Determine file type from URL and content-type
        const contentType = fileResponse.headers.get('content-type') || '';
        const fileName = file_url.split('/').pop().toLowerCase();
        const fileExt = fileName.split('.').pop();
        
        console.log('Content type:', contentType);
        console.log('File extension:', fileExt);

        // Determine appropriate media type for Mistral API
        let mediaType = 'application/pdf';
        let useVisionModel = false;

        // Image files - use vision model
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
            console.log('Detected image file, using vision model with media type:', mediaType);
        }
        // PDF files
        else if (fileExt === 'pdf' || contentType.includes('pdf')) {
            mediaType = 'application/pdf';
            useVisionModel = true;
            console.log('Detected PDF file');
        }
        // Word documents
        else if (fileExt === 'docx' || contentType.includes('wordprocessingml')) {
            mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            useVisionModel = true;
            console.log('Detected DOCX file');
        }
        else if (fileExt === 'doc' || contentType.includes('msword')) {
            mediaType = 'application/msword';
            useVisionModel = true;
            console.log('Detected DOC file');
        }
        // PowerPoint files
        else if (fileExt === 'pptx' || contentType.includes('presentationml')) {
            mediaType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            useVisionModel = true;
            console.log('Detected PPTX file');
        }
        else if (fileExt === 'ppt' || contentType.includes('ms-powerpoint')) {
            mediaType = 'application/vnd.ms-powerpoint';
            useVisionModel = true;
            console.log('Detected PPT file');
        }
        else {
            console.log('Unsupported file type, defaulting to PDF processing');
            mediaType = 'application/pdf';
            useVisionModel = true;
        }

        // Convert to base64
        console.log('Step 2: Converting to base64...');
        const arrayBuffer = await fileBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Efficient base64 encoding for large files
        const chunkSize = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Data = btoa(binary);
        console.log('✓ Base64 encoding complete');
        console.log('Base64 length:', base64Data.length);

        // Comprehensive extraction prompt
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
            temperature: 0.1,
            max_tokens: 16000
        };

        console.log('Request body size:', JSON.stringify(requestBody).length, 'bytes');
        console.log('Using model: pixtral-large-latest');
        console.log('Media type:', mediaType);

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
                errorDetails = 'Invalid request format. The file might be corrupted, too large, or the format is not supported by Mistral.';
            } else if (chatResponse.status === 413) {
                errorDetails = 'File or request too large for Mistral API. Try a smaller file.';
            } else if (chatResponse.status === 415) {
                errorDetails = 'Unsupported media type. Please use PDF, DOCX, PPTX, or image files (PNG, JPG, WEBP, GIF).';
            }

            return Response.json({ 
                error: 'Mistral API request failed', 
                details: errorDetails,
                status_code: chatResponse.status,
                file_type: mediaType,
                file_size_mb: (fileSize / 1024 / 1024).toFixed(2)
            }, { status: 500 });
        }

        const chatData = await chatResponse.json();
        console.log('✓ Mistral API response received');

        const extractedContent = chatData.choices?.[0]?.message?.content;

        if (!extractedContent || extractedContent.trim().length === 0) {
            console.error('=== NO CONTENT IN RESPONSE ===');
            console.error('Full response:', JSON.stringify(chatData, null, 2));
            return Response.json({ 
                error: 'No content extracted from document',
                details: 'The API returned an empty response. The document might be blank or unreadable.',
                response_preview: JSON.stringify(chatData).substring(0, 500)
            }, { status: 500 });
        }

        console.log('=== SUCCESS ===');
        console.log('Extracted content length:', extractedContent.length, 'characters');
        console.log('Preview:', extractedContent.substring(0, 300) + '...');

        return Response.json({ 
            extracted_content: extractedContent,
            characters: extractedContent.length,
            file_size: fileSize,
            file_type: mediaType,
            method: 'mistral_pixtral_large'
        });

    } catch (error) {
        console.error('=== FATAL ERROR ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return Response.json({ 
            error: 'Internal server error',
            message: error.message,
            type: error.constructor.name
        }, { status: 500 });
    }
});