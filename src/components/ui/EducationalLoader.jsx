import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Lightbulb, Globe, Calculator, Beaker, BookOpen, History, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const facts = [
  // Science & Space (20)
  { icon: Rocket, category: "Space", text: "Neutron stars are so dense that a teaspoonful would weigh about 6 billion tons." },
  { icon: Rocket, category: "Space", text: "There are more stars in the universe than grains of sand on all Earth's beaches." },
  { icon: Rocket, category: "Space", text: "A day on Venus is longer than a year on Venus." },
  { icon: Rocket, category: "Space", text: "Jupiter's Great Red Spot is a storm that has been raging for over 300 years." },
  { icon: Rocket, category: "Space", text: "Saturn's rings are mostly made of ice particles." },
  { icon: Globe, category: "Earth Science", text: "The Amazon Rainforest produces 20% of the world's oxygen." },
  { icon: Globe, category: "Earth Science", text: "Earth is the only planet not named after a god." },
  { icon: Globe, category: "Earth Science", text: "Lightning strikes the Earth about 100 times every second." },
  { icon: Globe, category: "Earth Science", text: "The deepest part of the ocean is the Mariana Trench at 36,000 feet deep." },
  { icon: Beaker, category: "Biology", text: "Human DNA is 50% identical to the DNA of a banana." },
  { icon: Beaker, category: "Biology", text: "The human brain generates enough electricity to power a small light bulb.", minGrade: 6 },
  { icon: Beaker, category: "Biology", text: "Octopuses have three hearts and blue blood." },
  { icon: Beaker, category: "Biology", text: "Butterflies can taste with their feet." },
  { icon: Beaker, category: "Biology", text: "A single human sneeze can travel up to 100 miles per hour." },
  { icon: Rocket, category: "Physics", text: "Light from the sun takes 8 minutes and 20 seconds to reach Earth." },
  { icon: Rocket, category: "Physics", text: "Time moves slower near massive objects due to gravitational time dilation.", minGrade: 9 },
  { icon: Rocket, category: "Physics", text: "Sound travels 4 times faster in water than in air." },
  { icon: Rocket, category: "Physics", text: "Diamonds can be made from peanut butter under extreme pressure." },
  { icon: Globe, category: "Ecology", text: "A single tree can absorb up to 48 pounds of carbon dioxide per year." },
  { icon: Globe, category: "Ecology", text: "Honey never spoils—archaeologists found 3,000-year-old honey that was still edible." },
  
  // Math (20)
  { icon: Calculator, category: "Mathematics", text: "Zero (0) is the only number that cannot be represented in Roman numerals." },
  { icon: Calculator, category: "Mathematics", text: "The symbol for division (÷) is called an obelus." },
  { icon: Calculator, category: "Mathematics", text: "Among all shapes with the same perimeter, a circle has the largest area." },
  { icon: Calculator, category: "Mathematics", text: "In a room of 23 people, there's a 50% chance that two people share a birthday.", minGrade: 9 },
  { icon: Calculator, category: "Mathematics", text: "The number Pi has been calculated to over 62 trillion digits." },
  { icon: Calculator, category: "Mathematics", text: "A 'jiffy' is an actual unit of time: 1/100th of a second." },
  { icon: Calculator, category: "Mathematics", text: "The sum of all numbers from 1 to 100 equals 5,050." },
  { icon: Calculator, category: "Mathematics", text: "If you shuffle a deck of cards, you've likely created a unique arrangement never seen before." },
  { icon: Calculator, category: "Mathematics", text: "The Fibonacci sequence appears in nature: flower petals, pine cones, and galaxies." },
  { icon: Calculator, category: "Mathematics", text: "A googol is 1 followed by 100 zeros." },
  { icon: Calculator, category: "Mathematics", text: "40 when written as 'forty' is the only number with letters in alphabetical order." },
  { icon: Calculator, category: "Mathematics", text: "Every odd number contains the letter 'e'." },
  { icon: Calculator, category: "Mathematics", text: "The golden ratio (1.618) is found throughout nature and art." },
  { icon: Calculator, category: "Mathematics", text: "111,111,111 × 111,111,111 = 12,345,678,987,654,321" },
  { icon: Calculator, category: "Mathematics", text: "A 'score' is 20 years, so Lincoln's 'four score' meant 80 years." },
  { icon: Calculator, category: "Mathematics", text: "The infinity symbol (∞) is called a lemniscate." },
  { icon: Calculator, category: "Mathematics", text: "There are more possible games of chess than atoms in the observable universe.", minGrade: 8 },
  { icon: Calculator, category: "Mathematics", text: "The equals sign (=) was invented in 1557." },
  { icon: Calculator, category: "Mathematics", text: "2 and 5 are the only prime numbers that end in 2 or 5." },
  { icon: Calculator, category: "Mathematics", text: "A circle has infinite lines of symmetry." },
  
  // History & Geography (20)
  { icon: History, category: "History", text: "The Great Wall of China is more than 13,000 miles long." },
  { icon: History, category: "History", text: "The first computer programmer was Ada Lovelace, in the mid-1800s." },
  { icon: History, category: "History", text: "Cleopatra lived closer in time to the moon landing than to the construction of the Great Pyramid.", minGrade: 6 },
  { icon: History, category: "History", text: "The shortest war in history lasted 38 minutes (Britain vs. Zanzibar, 1896)." },
  { icon: History, category: "History", text: "Napoleon Bonaparte was once attacked by a horde of bunnies." },
  { icon: History, category: "History", text: "The first alarm clock could only ring at 4 a.m." },
  { icon: History, category: "History", text: "Oxford University is older than the Aztec Empire." },
  { icon: History, category: "History", text: "Ancient Egyptians used slabs of stone as pillows." },
  { icon: History, category: "History", text: "The Roman Empire lasted for over 1,000 years." },
  { icon: History, category: "History", text: "The oldest known joke dates back to 1900 BC from ancient Sumer." },
  { icon: Globe, category: "Geography", text: "Russia has 11 distinct time zones, more than any other country." },
  { icon: Globe, category: "Geography", text: "Continents shift at about the same rate as your fingernails grow." },
  { icon: Globe, category: "Geography", text: "Canada has the longest coastline of any country in the world." },
  { icon: Globe, category: "Geography", text: "There are more lakes in Canada than in the rest of the world combined." },
  { icon: Globe, category: "Geography", text: "Africa is the only continent that spans all four hemispheres." },
  { icon: Globe, category: "Geography", text: "Mount Everest grows about 4 millimeters each year." },
  { icon: Globe, category: "Geography", text: "The Pacific Ocean is larger than all of Earth's land combined." },
  { icon: Globe, category: "Geography", text: "Istanbul, Turkey is the only city located on two continents." },
  { icon: Globe, category: "Geography", text: "Antarctica is a desert—the largest cold desert in the world." },
  { icon: Globe, category: "Geography", text: "The Dead Sea is the lowest point on Earth's surface." },
  
  // Language & Literature (15)
  { icon: BookOpen, category: "Language", text: "'E' is the most common letter and appears in 11 percent of all english words." },
  { icon: BookOpen, category: "Literature", text: "The shortest complete sentence in the English language is 'I am'." },
  { icon: BookOpen, category: "Language", text: "The word 'alphabet' comes from the first two Greek letters: alpha and beta." },
  { icon: BookOpen, category: "Language", text: "'Pneumonoultramicroscopicsilicovolcanoconiosis' is one of the longest words in English." },
  { icon: BookOpen, category: "Language", text: "Shakespeare invented over 1,700 words, including 'eyeball' and 'bedroom'." },
  { icon: BookOpen, category: "Literature", text: "Dr. Seuss wrote 'Green Eggs and Ham' using only 50 different words." },
  { icon: BookOpen, category: "Language", text: "The dot over the letter 'i' is called a tittle." },
  { icon: BookOpen, category: "Language", text: "No word in the English language rhymes with month, orange, silver, or purple." },
  { icon: BookOpen, category: "Language", text: "'Queue' is the only word that sounds the same when you remove its last four letters." },
  { icon: BookOpen, category: "Language", text: "The longest one-syllable word in English is 'screeched'." },
  { icon: BookOpen, category: "Language", text: "'Bookkeeper' is the only word with three consecutive double letters." },
  { icon: BookOpen, category: "Language", text: "The word 'swims' looks the same upside down." },
  { icon: BookOpen, category: "Language", text: "'Almost' is the longest word in English with all letters in alphabetical order." },
  { icon: BookOpen, category: "Literature", text: "The Harry Potter series has been translated into over 80 languages." },
  { icon: BookOpen, category: "Literature", text: "The first novel ever written is considered to be 'The Tale of Genji' from Japan in 1007." },
  
  // Chemistry & Technology (15)
  { icon: Beaker, category: "Chemistry", text: "Graphene is the strongest material known to man—200 times stronger than steel.", minGrade: 9 },
  { icon: Beaker, category: "Chemistry", text: "Water can boil and freeze at the same time (triple point).", minGrade: 8 },
  { icon: Beaker, category: "Chemistry", text: "The human body contains enough carbon to make 900 pencils." },
  { icon: Beaker, category: "Chemistry", text: "Pure gold is so soft you can mold it with your hands." },
  { icon: Beaker, category: "Chemistry", text: "Glass is technically a liquid that flows very, very slowly." },
  { icon: Beaker, category: "Chemistry", text: "A single bolt of lightning contains enough energy to toast 100,000 slices of bread." },
  { icon: Lightbulb, category: "Invention", text: "The first webcam was created at Cambridge University to check a coffee pot." },
  { icon: Lightbulb, category: "Technology", text: "The first computer bug was an actual moth trapped in a computer in 1947." },
  { icon: Lightbulb, category: "Technology", text: "The first iPhone was released in 2007." },
  { icon: Lightbulb, category: "Technology", text: "Email was invented before the World Wide Web." },
  { icon: Lightbulb, category: "Technology", text: "The password for the computer that launched nuclear missiles during the Cold War was '00000000'." },
  { icon: Lightbulb, category: "Technology", text: "The average person spends 6 hours and 58 minutes per day on screens.", minGrade: 7 },
  { icon: Lightbulb, category: "Invention", text: "The microwave oven was invented by accident when a chocolate bar melted in an engineer's pocket." },
  { icon: Lightbulb, category: "Invention", text: "Post-it Notes were invented by accident when trying to create a super-strong adhesive." },
  { icon: Lightbulb, category: "Technology", text: "The first computer mouse was made of wood." },
  
  // Fun Facts (10)
  { icon: Lightbulb, category: "Fun Fact", text: "Bananas are berries, but strawberries aren't." },
  { icon: Lightbulb, category: "Fun Fact", text: "A group of flamingos is called a 'flamboyance'." },
  { icon: Lightbulb, category: "Fun Fact", text: "Cows have best friends and get stressed when separated." },
  { icon: Lightbulb, category: "Fun Fact", text: "Penguins propose to their mates with pebbles." },
  { icon: Lightbulb, category: "Fun Fact", text: "The inventor of the Pringles can is now buried in one." },
  { icon: Lightbulb, category: "Fun Fact", text: "A group of pandas is called an 'embarrassment'." },
  { icon: Lightbulb, category: "Fun Fact", text: "Otters hold hands when they sleep so they don't drift apart." },
  { icon: Lightbulb, category: "Fun Fact", text: "Rats laugh when you tickle them." },
  { icon: Lightbulb, category: "Fun Fact", text: "Wombat poop is cube-shaped." },
  { icon: Lightbulb, category: "Fun Fact", text: "There are more fake flamingos in the world than real ones." }
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
  const [shownFactIndices, setShownFactIndices] = useState(new Set());

  useEffect(() => {
    const gradeNum = getGradeNumber(grade);
    const filtered = facts.filter(f => !f.minGrade || gradeNum >= f.minGrade);
    setRelevantFacts(filtered);
    
    // Set initial random fact
    if (filtered.length > 0) {
      const randomIndex = Math.floor(Math.random() * filtered.length);
      setCurrentFact(filtered[randomIndex]);
      setShownFactIndices(new Set([randomIndex]));
    }
  }, [grade]);

  useEffect(() => {
    if (relevantFacts.length === 0) return;
    
    const timer = setInterval(() => {
      // Get unshown facts
      const availableIndices = relevantFacts
        .map((_, idx) => idx)
        .filter(idx => !shownFactIndices.has(idx));
      
      // If all facts shown, reset
      if (availableIndices.length === 0) {
        setShownFactIndices(new Set());
        const randomIndex = Math.floor(Math.random() * relevantFacts.length);
        setCurrentFact(relevantFacts[randomIndex]);
        setShownFactIndices(new Set([randomIndex]));
      } else {
        // Pick from unshown facts
        const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        setCurrentFact(relevantFacts[randomIndex]);
        setShownFactIndices(prev => new Set([...prev, randomIndex]));
      }
    }, 3500);

    return () => clearInterval(timer);
  }, [relevantFacts, shownFactIndices]);

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