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

    const apiKey = Deno.env.get("API_KEY");
    if (!apiKey) {
      return Response.json({ error: 'API configuration missing' }, { status: 500 });
    }

    // 1. Download the file
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }
    const fileArrayBuffer = await fileResponse.arrayBuffer();
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileArrayBuffer)));
    
    // Determine mime type - simple check, default to pdf if unknown or extract from url
    let mimeType = "application/pdf";
    if (file_url.toLowerCase().endsWith(".png")) mimeType = "image/png";
    if (file_url.toLowerCase().endsWith(".jpg") || file_url.toLowerCase().endsWith(".jpeg")) mimeType = "image/jpeg";
    
    // 2. Gemini API Call (gemini-1.5-flash)
    const promptText = `
    Analyze this course outline/syllabus document and extract the following details into a JSON structure.
    
    CRITICAL: You must also classify the course into EXACTLY ONE of the following 5 subject categories based on its content:
    1. "Written & Interpretive Subjects (Humanities / Social Sciences)"
    2. "Problem-Solving & Conceptual Subjects (Math / Physics / Engineering)"
    3. "Applied & Empirical Subjects (Biology / Chemistry / Earth Sciences / Health Sciences)"
    4. "Computational & Logical Subjects (Computer Science / Programming / Data Structures)"
    5. "Quantitative Applied Subjects (Statistics / Economics / Finance / Business Analytics)"

    Data to Extract:
    - Course Code (e.g. GRST 211 L01)
    - Full Course Name (e.g. Technical Terms of Medical and Life Sciences)
    - Course Description (Summary of what the course covers)
    - Learning Outcomes (List of specific goals/outcomes)
    - Learning Resources (Textbooks, websites, etc.)
    - Assignments & Assessments (Title, Type [assignment/quiz/exam/project/other], Due Date, Weight %)
    - Required Readings (Specific chapters, articles, pages)
    - Grading System (Grade letter, Min %, Max %)

    Response JSON Schema:
    {
      "subject_category": "string (one of the 5 categories above)",
      "course_code": "string",
      "full_name": "string",
      "description": "string",
      "learning_outcomes": ["string"],
      "learning_resources": ["string"],
      "assessments": [{"title": "string", "type": "string", "due_date": "string", "weight": "string"}],
      "required_readings": ["string"],
      "grading_scale": [{"grade": "string", "min_score": number, "max_score": number}]
    }
    `;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64File
              }
            }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API Error:", errText);
      throw new Error("Failed to process document with AI");
    }

    const geminiData = await geminiResponse.json();
    const contentText = geminiData.candidates[0].content.parts[0].text;
    
    let extractedData;
    try {
      extractedData = JSON.parse(contentText);
    } catch (e) {
      console.error("Failed to parse Gemini JSON response", contentText);
      throw new Error("AI returned invalid JSON structure");
    }

    return Response.json(extractedData);

  } catch (error) {
    console.error("Error in extractCourseOutline:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});