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

        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: prompt,
            file_urls: file_url
        });

        if (!result || !result.trim()) {
            return Response.json({ 
                error: 'No content extracted from document'
            }, { status: 500 });
        }

        return Response.json({ 
            extracted_content: result,
            characters: result.length,
            method: 'base44_llm'
        });

    } catch (error) {
        console.error('Function error:', error);
        return Response.json({ 
            error: 'Internal server error',
            message: error.message
        }, { status: 500 });
    }
});