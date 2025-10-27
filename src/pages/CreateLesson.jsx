import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Link as LinkIcon, Upload, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreateLesson() {
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [inputType, setInputType] = useState("description");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!courseName.trim()) {
      setError("Please enter a course name");
      return;
    }

    if (inputType === "description" && !description.trim()) {
      setError("Please enter a lesson description");
      return;
    }

    if (inputType === "url" && !url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (inputType === "file" && !file) {
      setError("Please upload a file");
      return;
    }

    setIsProcessing(true);

    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        created_by: user.email 
      });

      let lessonData = {
        course_name: courseName,
        input_type: inputType,
        status: "created"
      };

      let contentForAI = "";

      if (inputType === "description") {
        lessonData.description = description;
        contentForAI = description;
      } else if (inputType === "url") {
        lessonData.url = url;
        contentForAI = `Content from URL: ${url}`;
      } else if (inputType === "file") {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        lessonData.file_url = file_url;
        contentForAI = `Uploaded file: ${file.name}`;
      }

      const aiPrompt = `
You are an educational curriculum designer. Based on the following information, create a comprehensive curriculum map.

Course Name: ${courseName}
Content: ${contentForAI}
Learner Profile: ${JSON.stringify(profile[0] || {})}

Generate a curriculum map with:
1. Key topics (array of 5-8 main topics)
2. Difficulty level (Beginner/Intermediate/Advanced)
3. Estimated duration (e.g., "4-6 weeks")
4. Key concepts (array of 8-12 important concepts to master)

Be specific and tailored to the learner's profile.
`;

      const curriculumMap = await base44.integrations.Core.InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            topics: { type: "array", items: { type: "string" } },
            difficulty: { type: "string" },
            estimated_duration: { type: "string" },
            key_concepts: { type: "array", items: { type: "string" } }
          }
        }
      });

      lessonData.curriculum_map = curriculumMap;

      const lesson = await base44.entities.Lesson.create(lessonData);

      navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lesson.id}`);
    } catch (error) {
      console.error("Error creating lesson:", error);
      setError("Failed to create lesson. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Home"))}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg mb-4">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-medium text-slate-700">AI-Powered Curriculum</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Create New Lesson</h1>
          <p className="text-slate-600 text-lg">Tell us about what you want to learn</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-2xl border-0">
          <CardHeader>
            <CardTitle>Lesson Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="courseName">Course Name *</Label>
                <Input
                  id="courseName"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g., Introduction to Python Programming"
                  className="text-base"
                />
              </div>

              <div className="space-y-4">
                <Label>How would you like to provide lesson content? *</Label>
                <RadioGroup value={inputType} onValueChange={setInputType}>
                  <div className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
                    <RadioGroupItem value="description" id="description" />
                    <Label htmlFor="description" className="flex items-center gap-3 cursor-pointer flex-1">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="font-medium">Write Description</p>
                        <p className="text-sm text-slate-500">Describe what you want to learn</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
                    <RadioGroupItem value="url" id="url" />
                    <Label htmlFor="url" className="flex items-center gap-3 cursor-pointer flex-1">
                      <LinkIcon className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Provide URL</p>
                        <p className="text-sm text-slate-500">Link to a course or article</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
                    <RadioGroupItem value="file" id="file" />
                    <Label htmlFor="file" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Upload className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="font-medium">Upload File</p>
                        <p className="text-sm text-slate-500">PDF, image, or document</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {inputType === "description" && (
                <div className="space-y-2">
                  <Label htmlFor="description">Lesson Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the topic you want to learn, what you hope to achieve, and any specific areas of focus..."
                    className="min-h-[150px] text-base"
                  />
                </div>
              )}

              {inputType === "url" && (
                <div className="space-y-2">
                  <Label htmlFor="url">Resource URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/course"
                    className="text-base"
                  />
                </div>
              )}

              {inputType === "file" && (
                <div className="space-y-2">
                  <Label htmlFor="file">Upload File *</Label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors">
                    <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                    <Input
                      id="file"
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    />
                    <Label htmlFor="file" className="cursor-pointer">
                      {file ? (
                        <p className="text-sm font-medium text-slate-700">{file.name}</p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-slate-500">
                            PDF, DOC, TXT, or images (Max 10MB)
                          </p>
                        </>
                      )}
                    </Label>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 py-6 text-lg shadow-xl"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating Your Personalized Lesson...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create Lesson & Start Diagnostic
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}