import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, BookOpen, ArrowRight, CheckCircle2, AlertCircle, Map } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { useQuery } from "@tanstack/react-query";
import LearningStyleQuestionnaire from "@/components/course-mapper/LearningStyleQuestionnaire";

export default function CourseMapper() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [manualCourseName, setManualCourseName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [mappedCourse, setMappedCourse] = useState(null);
  const [step, setStep] = useState(1); // 1: Upload, 3: Questionnaire (Step 2 skipped for background processing)
  const [pendingAnswers, setPendingAnswers] = useState(null); // Store answers if waiting for analysis

  // Fetch user grade for loader
  const { data: userGrade } = useQuery({
    queryKey: ['userGrade'],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (user?.learning_profile_id) {
        const profile = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
        return profile[0]?.grade;
      }
      return null;
    }
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      setFile(selectedFile);
      setError("");
    }
  };

  const handleUploadAndMap = async () => {
    if (!file) {
      setError("Please upload a course outline");
      return;
    }

    // Start with UI transition immediately
    setIsProcessing(true); // Brief loading for upload
    setError("");

    try {
      // 1. Upload File (Await this to ensure we have the file)
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Move to questionnaire immediately
      setStep(3);
      setIsProcessing(false);

      // 2. Trigger Background Analysis
      runBackgroundAnalysis(file_url);

    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload file. Please try again.");
      setIsProcessing(false);
    }
  };

  const runBackgroundAnalysis = async (file_url) => {
    try {
      console.log("Starting background analysis...");
      const { data: extractedData } = await base44.functions.invoke('extractCourseOutline', {
        file_url
      });

      const courseData = {
        ...extractedData,
        full_name: manualCourseName || extractedData.full_name || extractedData.course_code || "Untitled Course",
        file_url,
        status: "mapped"
      };

      const savedCourse = await base44.entities.Course.create(courseData);
      console.log("Course analyzed and saved:", savedCourse);
      setMappedCourse(savedCourse);

    } catch (err) {
      console.error("Background mapping error:", err);
      setError("Background analysis failed. Please try re-uploading.");
    }
  };

  // Effect to handle completion once both analysis and answers are ready
  React.useEffect(() => {
    const saveAndRedirect = async () => {
      if (mappedCourse && pendingAnswers) {
        setIsProcessing(true);
        try {
          await base44.entities.Course.update(mappedCourse.id, {
            learning_style_answers: pendingAnswers,
            status: "active"
          });
          navigate(createPageUrl("Home"));
        } catch (err) {
          console.error("Error saving answers:", err);
          setError("Failed to save your profile. Please try again.");
          setIsProcessing(false);
        }
      }
    };

    saveAndRedirect();
  }, [mappedCourse, pendingAnswers, navigate]);

  const handleQuestionnaireComplete = (answers) => {
    if (!mappedCourse) {
      // Analysis still running, store answers and wait (Effect will trigger)
      setPendingAnswers(answers);
      setIsProcessing(true); // Show loader while waiting
    } else {
      // Analysis done, proceed directly
      setPendingAnswers(answers);
    }
  };

  if (isProcessing) {
    return <EducationalLoader grade={userGrade} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10">
      <div className="max-w-3xl mx-auto">
        
        {/* Hero Section */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-6 md:p-8 shadow-xl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -mr-24 -mt-24" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400/20 rounded-full blur-xl -ml-16 -mb-16" />
            
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <Map className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Course Mapper</h1>
                <p className="text-white/90 text-sm md:text-base">Upload your syllabus to generate a personalized study roadmap</p>
              </div>
            </div>
          </div>
        </div>

        {step === 1 && (
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Upload Course Outline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="courseName">Course Name (Optional Override)</Label>
                <Input 
                  id="courseName"
                  placeholder="e.g. Introduction to Psychology" 
                  value={manualCourseName}
                  onChange={(e) => setManualCourseName(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  We'll try to extract the name automatically, but you can set it here.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Course Outline / Syllabus</Label>
                <div className={`
                  border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                  ${file ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
                `}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.ppt,.pptx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                    {file ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-blue-700 break-all">{file.name}</p>
                          <p className="text-xs text-blue-500 mt-1">Click to change</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700">Click to upload or drag and drop</p>
                          <p className="text-xs text-slate-500 mt-1">PDF, Word, Images (Max 5MB)</p>
                        </div>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg h-12"
                  onClick={handleUploadAndMap}
                  disabled={!file}
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Map My Course
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && mappedCourse && (
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
                Course Mapped Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-lg space-y-3 border border-slate-100">
                <div>
                  <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Course Code</p>
                  <p className="font-bold text-slate-800">{mappedCourse.course_code || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Course Name</p>
                  <p className="font-bold text-slate-800">{mappedCourse.full_name}</p>
                </div>
                {mappedCourse.subject_category && (
                  <div>
                    <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Subject Category</p>
                    <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium mt-1">
                      {mappedCourse.subject_category}
                    </span>
                  </div>
                )}
                {mappedCourse.description && (
                  <div>
                    <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Description</p>
                    <p className="text-sm text-slate-700 line-clamp-3">{mappedCourse.description}</p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 p-6 rounded-xl text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-900">Customize Your Learning Path</h3>
                  <p className="text-blue-700 max-w-md mx-auto mt-2">
                    We've extracted the details. Now, answer a few quick questions to help us tailor the study plan to your learning style.
                  </p>
                </div>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg shadow-lg shadow-blue-500/30"
                  onClick={() => setStep(3)}
                >
                  Start Personalization
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <LearningStyleQuestionnaire 
            courseName={mappedCourse?.full_name || manualCourseName}
            subjectCategory={mappedCourse?.subject_category}
            onComplete={handleQuestionnaireComplete}
          />
        )}

      </div>
    </div>
  );
}