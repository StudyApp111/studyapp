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
      return Response.json({ error: 'File URL is required' }, { status: 400 });
    }

    const apiKey = Deno.env.get("MistralDocumentAIKey");
    if (!apiKey) {
      return Response.json({ error: 'Mistral API configuration missing' }, { status: 500 });
    }

    // 1. Download the file
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }
    const fileBlob = await fileResponse.blob();

    // 2. Mistral API Call (using pixtral for document understanding)
    // We send the file as a base64 data URL or just rely on the public URL if Mistral supports it.
    // Mistral usually takes a prompt + image/text. For PDFs/Docs, we might need to use their specific OCR endpoint or just vision if we convert to image.
    // For simplicity in this specific environment context, assuming we treat it as an "image" url or extract text first.
    // However, the previous 'extractDocumentContent' used chat/completions with a specific model.
    // Let's stick to the pattern of sending the URL directly if supported, or base64.
    // Since `extractDocumentContent` used `pixtral-12b-2409`, we will use that.

    const chatResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "pixtral-12b-2409",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `Extract the following information from this course outline document into a structured JSON format:
                - Course Code (e.g. GRST 211 L01)
                - Full Course Name (e.g. Technical Terms of Medical and Life Sciences)
                - Course Description
                - Learning Outcomes (as a list)
                - Learning Resources (textbooks, websites, etc.)
                - Assignments & Assessments (title, type [assignment/quiz/exam], due date, weight)
                - Required Readings (chapters, articles)
                - Grading System (letter grade, min % score, max % score)

                Return ONLY valid JSON matching this schema:
                {
                  "course_code": "string",
                  "full_name": "string",
                  "description": "string",
                  "learning_outcomes": ["string"],
                  "learning_resources": ["string"],
                  "assessments": [{"title": "string", "type": "string", "due_date": "string", "weight": "string"}],
                  "required_readings": ["string"],
                  "grading_scale": [{"grade": "string", "min_score": number, "max_score": number}]
                }
                ` 
              },
              {
                type: "image_url",
                image_url: file_url 
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!chatResponse.ok) {
      const err = await chatResponse.text();
      console.error("Mistral API Error:", err);
      throw new Error("Failed to process document with AI");
    }

    const mistralData = await chatResponse.json();
    const content = mistralData.choices[0].message.content;
    
    // Parse the JSON content
    let extractedData;
    try {
      extractedData = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse Mistral JSON response", content);
      // Fallback or partial parse could go here, but for now throw
      throw new Error("AI returned invalid JSON structure");
    }

    return Response.json(extractedData);

  } catch (error) {
    console.error("Error in extractCourseOutline:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});