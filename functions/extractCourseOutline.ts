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

    const googleApiKey = Deno.env.get("API_KEY");
    if (!googleApiKey) {
      return Response.json({ error: 'Google API configuration missing' }, { status: 500 });
    }

    // 1. OCR with Mistral (using the existing extractDocumentContent function)
    // We invoke the other function to handle the OCR part with Mistral as requested
    console.log("Invoking Mistral OCR...");
    const ocrResult = await base44.functions.invoke('extractDocumentContent', { file_url });
    
    if (!ocrResult.data || !ocrResult.data.extracted_content) {
      console.error("Mistral OCR failed:", ocrResult);
      throw new Error("Failed to extract text using Mistral OCR");
    }

    const extractedText = ocrResult.data.extracted_content;
    console.log("OCR Success, text length:", extractedText.length);

    // 2. Structure & Classify with Gemini 2.5 Flash Lite
    const promptText = `
    Analyze the following course outline text (extracted via OCR) and extract the details into a JSON structure.
    
    CRITICAL: Classify the course into EXACTLY ONE of the following 5 subject categories:
    1. "Written & Interpretive Subjects (Humanities / Social Sciences)"
    2. "Problem-Solving & Conceptual Subjects (Math / Physics / Engineering)"
    3. "Applied & Empirical Subjects (Biology / Chemistry / Earth Sciences / Health Sciences)"
    4. "Computational & Logical Subjects (Computer Science / Programming / Data Structures)"
    5. "Quantitative Applied Subjects (Statistics / Economics / Finance / Business Analytics)"

    Data to Extract:
    - Course Code (e.g. GRST 211 L01)
    - Full Course Name (e.g. Technical Terms of Medical and Life Sciences)
    - Course Description (Summary)
    - Learning Outcomes (List)
    - Learning Resources (List)
    - Assignments & Assessments (Title, Type [assignment/quiz/exam/project/other], Due Date, Weight %)
    - Required Readings (List)
    - Grading System (Grade letter, Min %, Max %)

    Text Content:
    ${extractedText.substring(0, 30000)} 

    Response JSON Schema:
    {
      "subject_category": "string",
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

    console.log("Calling Gemini 2.5-flash-lite...");
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${googleApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API Error:", errText);
      
      // Fallback to 1.5-flash if 2.5 fails (just in case, though user insisted on 2.5)
      // But per instructions I must use 2.5. I will throw the error to be transparent if it fails.
      throw new Error(`Gemini API Failed: ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const contentJsonString = geminiData.candidates[0].content.parts[0].text;
    
    let finalData;
    try {
      finalData = JSON.parse(contentJsonString);
    } catch (e) {
      console.error("Failed to parse Gemini JSON", contentJsonString);
      throw new Error("AI returned invalid JSON structure");
    }

    return Response.json(finalData);

  } catch (error) {
    console.error("Error in extractCourseOutline:", error);
    return Response.json({ 
      error: error.message, 
      details: error.toString() 
    }, { status: 500 });
  }
});