import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    console.log('=== extractDocumentContent Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.log('User authenticated:', user.email);

        const { file_url } = await req.json();

        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }
        console.log('File URL received:', file_url);

        const googleApiKey = Deno.env.get("GEMINIAPIKEY");
        if (!googleApiKey) {
            return Response.json({ error: 'Google API key not configured' }, { status: 500 });
        }

        // Download file
        console.log('Downloading file...');
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            return Response.json({ 
                error: 'Failed to download file',
                status: fileResponse.status
            }, { status: 500 });
        }

        const fileBlob = await fileResponse.blob();
        const fileSize = fileBlob.size;
        console.log('File size:', fileSize, 'bytes');

        if (fileSize > 10 * 1024 * 1024) {
            return Response.json({ 
                error: 'File too large. Please upload files smaller than 10MB.' 
            }, { status: 400 });
        }

        // Determine file type - strip query params first
        const urlPath = new URL(file_url).pathname;
        const fileName = urlPath.split('/').pop().toLowerCase();
        const fileExt = fileName.split('.').pop();
        console.log('File name:', fileName, 'Extension:', fileExt);

        // Direct text extraction for .txt files
        if (fileExt === 'txt') {
            const text = await fileBlob.text();
            if (text && text.trim().length > 0) {
                return Response.json({ 
                    extracted_content: text.trim(),
                    characters: text.trim().length,
                    file_size: fileSize,
                    file_type: 'TEXT',
                    method: 'direct_text_extraction'
                });
            }
        }

        const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'heif', 'avif'];
        const documentFormats = ['pdf', 'pptx', 'docx', 'doc', 'ppt'];
        
        const isImage = imageFormats.includes(fileExt);
        const isDocument = documentFormats.includes(fileExt);

        if (!isImage && !isDocument && fileExt !== 'txt') {
            return Response.json({ 
                error: 'Unsupported file format',
                details: `File type .${fileExt} is not supported.`
            }, { status: 400 });
        }

        // For PDFs, try direct text extraction first
        if (fileExt === 'pdf') {
            try {
                const pdf = (await import('npm:pdf-parse@1.1.1')).default;
                const arrayBuffer = await fileBlob.arrayBuffer();
                const pdfData = await pdf(new Uint8Array(arrayBuffer));
                const extractedText = pdfData.text?.trim();
                
                if (extractedText && extractedText.length > 50) {
                    console.log('Direct PDF extraction successful');
                    return Response.json({ 
                        extracted_content: extractedText,
                        characters: extractedText.length,
                        file_size: fileSize,
                        file_type: 'PDF',
                        method: 'direct_pdf_parse',
                        pages: pdfData.numpages
                    });
                }
            } catch (pdfError) {
                console.log('Direct PDF extraction failed, falling back to Google Vision OCR');
            }
        }

        // For DOCX, try mammoth extraction
        if (fileExt === 'docx') {
            try {
                const mammoth = await import('npm:mammoth@1.6.0');
                const arrayBuffer = await fileBlob.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                
                if (result.value && result.value.trim().length > 50) {
                    return Response.json({ 
                        extracted_content: result.value.trim(),
                        characters: result.value.trim().length,
                        file_size: fileSize,
                        file_type: 'DOCX',
                        method: 'direct_docx_extraction'
                    });
                }
            } catch (docxError) {
                console.log('Direct DOCX extraction failed, falling back to Google Vision OCR');
            }
        }

        // Use Gemini for document/image OCR and understanding
        console.log('Using Gemini Vision for OCR...');
        
        // Convert blob to base64 - chunked approach for large files
        const arrayBuffer = await fileBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Process in chunks to avoid stack overflow on large files
        let base64Content = '';
        const chunkSize = 32768; // 32KB chunks
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            base64Content += String.fromCharCode.apply(null, chunk);
        }
        base64Content = btoa(base64Content);
        console.log('Base64 encoding complete, length:', base64Content.length);
        
        // Determine MIME type - Gemini requires specific supported types
        const mimeTypes = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'webp': 'image/webp',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'tiff': 'image/tiff',
            'heif': 'image/heif',
            'heic': 'image/heif',
            'avif': 'image/avif',
            'pdf': 'application/pdf'
        };
        const mimeType = mimeTypes[fileExt];
        
        // If not a supported Gemini mime type, go directly to Base44 extraction
        if (!mimeType) {
            console.log(`File type .${fileExt} not supported by Gemini, using Base44 extraction...`);
            
            try {
                const base44Result = await base44.integrations.Core.ExtractDataFromUploadedFile({
                    file_url: file_url,
                    json_schema: {
                        type: "object",
                        properties: {
                            full_text_content: {
                                type: "string",
                                description: "The complete extracted text content from the document"
                            }
                        }
                    }
                });
                
                if (base44Result.status === 'success' && base44Result.output?.full_text_content) {
                    const content = base44Result.output.full_text_content;
                    console.log('Base44 extraction successful, length:', content.length);
                    
                    return Response.json({ 
                        extracted_content: content.trim(),
                        characters: content.trim().length,
                        file_size: fileSize,
                        file_type: 'DOCUMENT',
                        method: 'base44_extraction'
                    });
                }
            } catch (base44Error) {
                console.error('Base44 extraction failed:', base44Error.message);
            }
            
            return Response.json({ 
                error: 'Unsupported file format for OCR',
                details: `File type .${fileExt} could not be processed.`
            }, { status: 400 });
        }

        const geminiRequestBody = {
            contents: [{
                parts: [
                    { text: 'Extract ALL educational content from this document. Include every detail - text, questions, rubrics, criteria, and instructions. Preserve structure and formatting.' },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Content
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 8192
            }
        };

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiRequestBody)
            }
        );

        let extractedContent = null;
        
        if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            extractedContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        }

        // If Gemini failed or returned empty, fallback to Base44 ExtractDataFromUploadedFile
        if (!extractedContent || extractedContent.trim().length === 0) {
            console.log('Gemini Vision failed or empty, falling back to Base44 ExtractDataFromUploadedFile...');
            
            try {
                const base44Result = await base44.integrations.Core.ExtractDataFromUploadedFile({
                    file_url: file_url,
                    json_schema: {
                        type: "object",
                        properties: {
                            full_text_content: {
                                type: "string",
                                description: "The complete extracted text content from the document"
                            }
                        }
                    }
                });
                
                if (base44Result.status === 'success' && base44Result.output?.full_text_content) {
                    extractedContent = base44Result.output.full_text_content;
                    console.log('Base44 extraction successful, length:', extractedContent.length);
                    
                    return Response.json({ 
                        extracted_content: extractedContent.trim(),
                        characters: extractedContent.trim().length,
                        file_size: fileSize,
                        file_type: isImage ? 'IMAGE' : 'DOCUMENT',
                        method: 'base44_extraction'
                    });
                }
            } catch (base44Error) {
                console.error('Base44 extraction also failed:', base44Error.message);
            }
            
            return Response.json({ 
                error: 'No content extracted from document'
            }, { status: 500 });
        }

        console.log('Content extracted via Gemini Vision, length:', extractedContent.length);

        return Response.json({ 
            extracted_content: extractedContent.trim(),
            characters: extractedContent.trim().length,
            file_size: fileSize,
            file_type: isImage ? 'IMAGE' : 'DOCUMENT',
            method: 'gemini_vision_ocr'
        });

    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ 
            error: 'Document processing failed',
            message: error.message
        }, { status: 500 });
    }
});