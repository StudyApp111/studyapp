import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SAMPLE_REPORTS = {
  low: {
    predicted_grade: "F",
    predicted_percentage: 32,
    confidence_level: "Low",
    prediction_confidence: 25,
    study_intensity: "High - Rescue Mission",
    estimated_study_time_days: 21,
    strong_areas: [
      "Evaluating core philosophical frameworks",
      "Identifying autonomy themes in political theory"
    ],
    weak_areas_detailed: [
      { topic: "Social Contract Traditions (Hobbes vs. Locke)", grade_impact: "-20%", severity: "critical", recommended_tool: "AI Professor", specific_fix: "Confusing assumptions and state-of-nature logic leads to lost marks in comparison questions." },
      { topic: "Rawlsian Methodology (Reflective Equilibrium)", grade_impact: "-20%", severity: "critical", recommended_tool: "Teach It Cards", specific_fix: "If method steps are unclear, argument quality drops on short-answer and essay items." },
      { topic: "Comparative Paradigms (Foucault vs. Marx)", grade_impact: "-15%", severity: "high", recommended_tool: "Practice Questions", specific_fix: "Mixed frameworks cause weak thesis positioning and evidence mismatch." }
    ],
    preview_question: {
      question_text: "Compare Hobbes' and Locke's conceptions of the state of nature. How do their differing assumptions lead to contrasting views on the legitimate basis of political authority?",
      question_type: "Short Answer",
      correct_answer: "Hobbes envisions a state of nature as a war of all against all, leading to an absolute sovereign for security. Locke sees it as a state of freedom with natural rights, leading to limited government by consent. Their differing views on human nature directly shape their theories of political legitimacy.",
      why_this_matters: "This comparison question is a staple of political theory exams and tests your ability to synthesize two frameworks."
    },
    grade_trajectory: {
      current: "F (32%)",
      week_1_target: "D (42%)",
      week_1_percentage: 42,
      week_2_target: "D+ (54%)",
      week_2_percentage: 54,
      week_3_target: "C- (65%)",
      week_3_percentage: 65,
      final_target: "C-"
    },
    personalized_message_line1: "Your current diagnostic score is 32%.",
    personalized_message_line2: "We can build a plan to reach a C by the final.",
    personalized_message_line3: "This is fixable with targeted focus on core theoretical frameworks.",
    urgency_timeline: {
      start_today: "clear path to a passing grade and likely C-range momentum",
      wait_5_days: "requires significantly more daily study intensity",
      wait_10_days: "recovery remains possible, but effort and stress increase sharply"
    },
    top_priority_action: "Master Hobbes vs. Locke comparison",
    toolkit_social_proof: {}
  },
  mid: {
    predicted_grade: "B",
    predicted_percentage: 78,
    confidence_level: "Medium",
    prediction_confidence: 45,
    study_intensity: "Moderate",
    estimated_study_time_days: 14,
    strong_areas: [
      "Algorithmic reasoning and recursive problem-solving skills",
      "Classes and Object-Oriented Programming (OOP)",
      "Data abstraction and Abstract Data Types (ADTs)"
    ],
    weak_areas_detailed: [
      { topic: "Classic data structures (linked data structures)", grade_impact: "-15%", severity: "high", recommended_tool: "AI Tutor", specific_fix: "Linked list traversal and pointer manipulation errors are common in exam scenarios." },
      { topic: "C++ basics (pass-by-reference semantics)", grade_impact: "-12%", severity: "high", recommended_tool: "Practice Questions", specific_fix: "Reference vs value confusion leads to incorrect output predictions." }
    ],
    preview_question: {
      question_text: "Given a singly linked list, write a function that reverses it in-place. What is the time and space complexity?",
      question_type: "Short Answer",
      correct_answer: "Use three pointers (prev, curr, next) to iteratively reverse links. Time: O(n), Space: O(1).",
      why_this_matters: "Linked list reversal tests pointer manipulation which is heavily tested in midterms."
    },
    grade_trajectory: {
      current: "B (78%)",
      week_1_target: "B+ (83%)",
      week_1_percentage: 83,
      week_2_target: "A- (88%)",
      week_2_percentage: 88,
      week_3_target: "A (93%)",
      week_3_percentage: 93,
      final_target: "A"
    },
    personalized_message_line1: "Your current diagnostic score is 78%.",
    personalized_message_line2: "You're close to an A — a few targeted fixes will get you there.",
    personalized_message_line3: "Your fundamentals are solid. Focus on data structures and C++ semantics.",
    urgency_timeline: {
      start_today: "A is very achievable within 2 weeks",
      wait_5_days: "A- ceiling, less time for practice exams",
      wait_10_days: "B+ ceiling, missed optimization window"
    },
    top_priority_action: "Master linked data structures",
    toolkit_social_proof: {}
  },
  high: {
    predicted_grade: "A",
    predicted_percentage: 92,
    confidence_level: "High",
    prediction_confidence: 60,
    study_intensity: "10-14 hours/week",
    estimated_study_time_days: 7,
    strong_areas: [
      "Thermodynamics fundamentals",
      "Kinematics and projectile motion",
      "Wave mechanics and interference"
    ],
    weak_areas_detailed: [
      { topic: "Electromagnetic induction edge cases", grade_impact: "-5%", severity: "medium", recommended_tool: "Practice Questions", specific_fix: "Lenz's law application in non-standard geometries trips up high-performers." },
      { topic: "Relativistic momentum calculations", grade_impact: "-3%", severity: "low", recommended_tool: "Teach It Cards", specific_fix: "Sign errors in Lorentz factor calculations at exam speed." }
    ],
    preview_question: {
      question_text: "A conducting loop enters a region of uniform magnetic field at constant velocity. Sketch and explain the induced EMF as a function of time.",
      question_type: "Short Answer",
      correct_answer: "EMF is zero when fully inside/outside, positive when entering (increasing flux), negative when exiting (decreasing flux). Follows Faraday's law.",
      why_this_matters: "EMF sketching questions appear on nearly every Physics 30 final."
    },
    grade_trajectory: {
      current: "A (92%)",
      week_1_target: "A (94%)",
      week_1_percentage: 94,
      week_2_target: "A+ (96%)",
      week_2_percentage: 96,
      week_3_target: "A+ (98%)",
      week_3_percentage: 98,
      final_target: "A+"
    },
    personalized_message_line1: "Your current diagnostic score is 92%.",
    personalized_message_line2: "You're already in A territory — let's lock in A+.",
    personalized_message_line3: "Stay sharp on untested material and edge cases.",
    urgency_timeline: {
      start_today: "A+ is locked in with minimal effort",
      wait_5_days: "A is safe but A+ requires focused practice",
      wait_10_days: "A is still likely but no room for error"
    },
    top_priority_action: "Practice electromagnetic induction edge cases",
    toolkit_social_proof: {}
  }
};

export default function TestReportCard() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState("low");
  const [courseName, setCourseName] = useState("POLI 418");
  const [schoolName, setSchoolName] = useState("University of Calgary");
  const [studentName, setStudentName] = useState("Alex");

  const handleGo = () => {
    const report = SAMPLE_REPORTS[preset];
    const reportStr = encodeURIComponent(JSON.stringify(report));
    navigate(`${createPageUrl("PredictedGradeDisplay")}?name=${encodeURIComponent(studentName)}&school=${encodeURIComponent(schoolName)}&courseCode=${encodeURIComponent(courseName)}&reportData=${reportStr}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-700 max-w-md w-full space-y-5">
        <h1 className="text-2xl font-bold text-white text-center">🧪 Report Card Tester</h1>
        <p className="text-slate-400 text-sm text-center">Jump straight to the report card with sample data.</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Preset</label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (F — 32%)</SelectItem>
                <SelectItem value="mid">Mid (B — 78%)</SelectItem>
                <SelectItem value="high">High (A — 92%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Student Name</label>
            <Input value={studentName} onChange={e => setStudentName(e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Course</label>
            <Input value={courseName} onChange={e => setCourseName(e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">School</label>
            <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
          </div>

          <Button onClick={handleGo} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 text-lg rounded-xl">
            View Report Card →
          </Button>
        </div>
      </div>
    </div>
  );
}