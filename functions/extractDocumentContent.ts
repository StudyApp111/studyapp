import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Mistral OCR fallback for unsupported file types or when Gemini fails
async function extractWithMistralOCR(fileUrl, fileExt) {
    const mistralApiKey = Deno.env.get("MistralDocumentAIKey");
    if (!mistralApiKey) {
        console.error('Mistral API key not configured');
        return { success: false, error: 'Mistral API key not configured' };
    }

    try {
        console.log('Calling Mistral OCR API...');
        
        // Determine document type for Mistral
        const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'heif', 'avif'];
        const isImage = imageFormats.includes(fileExt);
        
        const documentType = isImage ? 'image_url' : 'document_url';
        const documentKey = isImage ? 'image_url' : 'document_url';
        
        const mistralResponse = await fetch('https://api.mistral.ai/v1/ocr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mistralApiKey}`
            },
            body: JSON.stringify({
                model: 'mistral-ocr-latest',
                document: {
                    type: documentType,
                    [documentKey]: fileUrl
                }
            })
        });

        if (!mistralResponse.ok) {
            const errorText = await mistralResponse.text();
            console.error('Mistral OCR API error:', errorText);
            return { success: false, error: errorText };
        }

        const mistralData = await mistralResponse.json();
        
        // Extract text from all pages
        let fullContent = '';
        if (mistralData.pages && Array.isArray(mistralData.pages)) {
            fullContent = mistralData.pages
                .map(page => page.markdown || '')
                .join('\n\n');
        }

        if (fullContent && fullContent.trim().length > 0) {
            console.log('Mistral OCR extraction successful, length:', fullContent.length);
            return { success: true, content: fullContent };
        }

        return { success: false, error: 'No content extracted' };
    } catch (error) {
        console.error('Mistral OCR error:', error.message);
        return { success: false, error: error.message };
    }
}

Deno.serve(async (req) => {
    console.log('=== extractDocumentContent Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        
        // Try to get user but don't require authentication (onboarding flow)
        let user = null;
        try {
            user = await base44.auth.me();
            console.log('User authenticated:', user?.email);
        } catch (authError) {
            console.log('No user authentication - proceeding for onboarding flow');
        }

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

        // For large files or PDFs/DOCX, prefer Mistral OCR (handles URLs directly, no CPU-heavy processing)
        // This avoids CPU timeouts from downloading/encoding large files
        if (fileSize > 2 * 1024 * 1024 || fileExt === 'pdf' || fileExt === 'docx' || fileExt === 'pptx') {
            console.log('Large file or document detected, using Mistral OCR (URL-based)...');
            
            const mistralResult = await extractWithMistralOCR(file_url, fileExt);
            if (mistralResult.success && mistralResult.content.trim().length > 50) {
                return Response.json({ 
                    extracted_content: mistralResult.content.trim(),
                    characters: mistralResult.content.trim().length,
                    file_size: fileSize,
                    file_type: fileExt.toUpperCase(),
                    method: 'mistral_ocr'
                });
            }
            
            // Mistral failed, try direct extraction for smaller PDFs only
            if (fileExt === 'pdf' && fileSize < 3 * 1024 * 1024) {
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
                    console.log('Direct PDF extraction failed:', pdfError.message);
                }
            }
            
            // For DOCX, try mammoth as fallback
            if (fileExt === 'docx' && fileSize < 3 * 1024 * 1024) {
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
                    console.log('Direct DOCX extraction failed:', docxError.message);
                }
            }
            
            return Response.json({ 
                error: 'Could not extract content from document',
                details: 'The document may be scanned or image-based. Please try a different file.'
            }, { status: 400 });
        }

        // For images and small files, use Gemini Vision
        console.log('Using Gemini Vision for OCR...');
        
        // Convert blob to base64
        const arrayBuffer = await fileBlob.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
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
        
        // If not a supported Gemini mime type, go directly to Mistral OCR
        if (!mimeType) {
            console.log(`File type .${fileExt} not supported by Gemini, using Mistral OCR...`);
            
            const mistralResult = await extractWithMistralOCR(file_url, fileExt);
            if (mistralResult.success) {
                return Response.json({ 
                    extracted_content: mistralResult.content.trim(),
                    characters: mistralResult.content.trim().length,
                    file_size: fileSize,
                    file_type: 'DOCUMENT',
                    method: 'mistral_ocr'
                });
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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${googleApiKey}`,
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

        // If Gemini failed or returned empty, fallback to Mistral OCR
        if (!extractedContent || extractedContent.trim().length === 0) {
            console.log('Gemini Vision failed or empty, falling back to Mistral OCR...');
            
            const mistralResult = await extractWithMistralOCR(file_url, fileExt);
            if (mistralResult.success) {
                return Response.json({ 
                    extracted_content: mistralResult.content.trim(),
                    characters: mistralResult.content.trim().length,
                    file_size: fileSize,
                    file_type: isImage ? 'IMAGE' : 'DOCUMENT',
                    method: 'mistral_ocr'
                });
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