import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Lightbulb, Globe, Calculator, Beaker, BookOpen, History, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const facts = [
  // Science & Space
  { icon: Rocket, category: "Space", text: "Neutron stars are so dense that a teaspoonful would weigh about 6 billion tons." },
  { icon: Globe, category: "Earth Science", text: "The Amazon Rainforest produces 20% of the world's oxygen." },
  { icon: Beaker, category: "Biology", text: "Human DNA is 50% identical to the DNA of a banana." },
  { icon: Rocket, category: "Physics", text: "Light from the sun takes 8 minutes and 20 seconds to reach Earth." },
  { icon: Globe, category: "Ecology", text: "A single tree can absorb up to 48 pounds of carbon dioxide per year." },
  
  // Math
  { icon: Calculator, category: "Mathematics", text: "Zero (0) is the only number that cannot be represented in Roman numerals." },
  { icon: Calculator, category: "Mathematics", text: "The symbol for division (÷) is called an obelus." },
  { icon: Calculator, category: "Mathematics", text: "Among all shapes with the same perimeter, a circle has the largest area." },
  
  // History & Geography
  { icon: History, category: "History", text: "The Great Wall of China is more than 13,000 miles long." },
  { icon: Globe, category: "Geography", text: "Russia has 11 distinct time zones, more than any other country." },
  { icon: History, category: "History", text: "The first computer programmer was Ada Lovelace, in the mid-1800s." },
  { icon: Globe, category: "Geography", text: "Continents shift at about the same rate as your fingernails grow." },
  
  // General Knowledge
  { icon: BookOpen, category: "Language", text: "'E' is the most common letter and appears in 11 percent of all english words." },
  { icon: Lightbulb, category: "Invention", text: "The first webcam was created at Cambridge University to check a coffee pot." },
  { icon: BookOpen, category: "Literature", text: "The shortest complete sentence in the English language is 'I am'." },
  
  // Higher Level (Grade 9+)
  { icon: Beaker, category: "Chemistry", text: "Graphene is the strongest material known to man—200 times stronger than steel.", minGrade: 9 },
  { icon: Calculator, category: "Mathematics", text: "In a room of 23 people, there's a 50% chance that two people share a birthday.", minGrade: 9 },
  { icon: Rocket, category: "Physics", text: "Time moves slower near massive objects due to gravitational time dilation.", minGrade: 9 },
  { icon: History, category: "History", text: "Cleopatra lived closer in time to the moon landing than to the construction of the Great Pyramid.", minGrade: 6 },
  { icon: Beaker, category: "Biology", text: "The human brain generates enough electricity to power a small light bulb.", minGrade: 6 },
];

const getGradeNumber = (gradeStr) => {
  if (!gradeStr) return 0;
  if (gradeStr.includes("University") || gradeStr.includes("Post")) return 13;
  const match = gradeStr.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

export default function EducationalLoader({ title = "Creating Your Lesson", description = "Our AI is analyzing the curriculum and generating personalized content...", grade }) {
  const [currentFact, setCurrentFact] = useState(null);
  const [relevantFacts, setRelevantFacts] = useState([]);

  useEffect(() => {
    const gradeNum = getGradeNumber(grade);
    const filtered = facts.filter(f => !f.minGrade || gradeNum >= f.minGrade);
    setRelevantFacts(filtered);
    
    // Set initial random fact
    if (filtered.length > 0) {
      setCurrentFact(filtered[Math.floor(Math.random() * filtered.length)]);
    }
  }, [grade]);

  useEffect(() => {
    if (relevantFacts.length === 0) return;
    
    const timer = setInterval(() => {
      // Pick completely random fact each time
      const randomIndex = Math.floor(Math.random() * relevantFacts.length);
      setCurrentFact(relevantFacts[randomIndex]);
    }, 3500);

    return () => clearInterval(timer);
  }, [relevantFacts]);

  if (!currentFact) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-lg text-center p-8 md:p-10 shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
          <div className="mb-8 relative flex justify-center items-center">
            <div className="absolute w-20 h-20 bg-purple-100 rounded-full scale-150 opacity-20 animate-pulse" />
            <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-purple-600 animate-spin relative z-10" />
          </div>
          
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
            {title}
          </h2>
          <p className="text-slate-500 mb-8">
            {description}
          </p>
        </Card>
      </div>
    );
  }

  const Icon = currentFact.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-lg text-center p-8 md:p-10 shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
        <div className="mb-8 relative flex justify-center items-center">
          <div className="absolute w-20 h-20 bg-purple-100 rounded-full scale-150 opacity-20 animate-pulse" />
          <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-purple-600 animate-spin relative z-10" />
        </div>
        
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
          {title}
        </h2>
        <p className="text-slate-500 mb-8">
          {description}
        </p>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-8" />

        <div className="min-h-[180px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFact.text}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="p-3 bg-yellow-50 rounded-2xl text-yellow-600">
                <Icon className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider bg-purple-50 px-2 py-1 rounded-md">
                  Did You Know? • {currentFact.category}
                </span>
                <p className="text-lg md:text-xl font-medium text-slate-800 leading-relaxed max-w-sm">
                  {currentFact.text}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}