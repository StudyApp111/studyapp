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

        const googleApiKey = Deno.env.get("API_KEY");
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

        // Determine file type
        const fileName = file_url.split('/').pop().toLowerCase();
        const fileExt = fileName.split('.').pop();
        console.log('File type:', fileExt);

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

        // Use Google Vision OCR for images and fallback for documents
        console.log('Using Google Vision OCR...');
        
        // Convert blob to base64
        const arrayBuffer = await fileBlob.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        const visionRequestBody = {
            requests: [{
                image: { content: base64Content },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
            }]
        };

        const visionResponse = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(visionRequestBody)
            }
        );

        if (!visionResponse.ok) {
            const errorBody = await visionResponse.text();
            console.error('Google Vision API error:', errorBody);
            return Response.json({ 
                error: 'Google Vision API request failed',
                details: errorBody
            }, { status: 500 });
        }

        const visionData = await visionResponse.json();
        const extractedContent = visionData.responses?.[0]?.fullTextAnnotation?.text;

        if (!extractedContent || extractedContent.trim().length === 0) {
            return Response.json({ 
                error: 'No content extracted from document'
            }, { status: 500 });
        }

        console.log('Content extracted via Google Vision, length:', extractedContent.length);

        return Response.json({ 
            extracted_content: extractedContent.trim(),
            characters: extractedContent.trim().length,
            file_size: fileSize,
            file_type: isImage ? 'IMAGE' : 'DOCUMENT',
            method: 'google_vision_ocr'
        });

    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ 
            error: 'Document processing failed',
            message: error.message
        }, { status: 500 });
    }
});