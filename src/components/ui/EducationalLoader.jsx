import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// 200+ fun facts embedded directly for instant loading
const FUN_FACTS = [
  { fact_text: "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.", category: "Science", icon: "🍯" },
  { fact_text: "Octopuses have three hearts and blue blood.", category: "Biology", icon: "🐙" },
  { fact_text: "A day on Venus is longer than a year on Venus.", category: "Space", icon: "🪐" },
  { fact_text: "Bananas are berries, but strawberries aren't.", category: "Biology", icon: "🍌" },
  { fact_text: "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion.", category: "Physics", icon: "🗼" },
  { fact_text: "There are more possible iterations of a game of chess than there are atoms in the observable universe.", category: "Math", icon: "♟️" },
  { fact_text: "A group of flamingos is called a 'flamboyance'.", category: "Nature", icon: "🦩" },
  { fact_text: "The shortest war in history lasted 38 to 45 minutes.", category: "History", icon: "⚔️" },
  { fact_text: "Sharks existed before trees.", category: "History", icon: "🦈" },
  { fact_text: "The inventor of the Pringles can is buried in one.", category: "Fun", icon: "🥔" },
  { fact_text: "A jiffy is an actual unit of time: 1/100th of a second.", category: "Science", icon: "⏱️" },
  { fact_text: "The heart of a shrimp is located in its head.", category: "Biology", icon: "🦐" },
  { fact_text: "It's impossible to hum while holding your nose.", category: "Fun", icon: "🎵" },
  { fact_text: "A bolt of lightning is five times hotter than the surface of the sun.", category: "Science", icon: "⚡" },
  { fact_text: "The inventor of the microwave only received $2 for his discovery.", category: "History", icon: "📻" },
  { fact_text: "Cows have best friends and get stressed when separated.", category: "Nature", icon: "🐄" },
  { fact_text: "The longest hiccuping spree lasted 68 years.", category: "Fun", icon: "😮" },
  { fact_text: "Scotland's national animal is the unicorn.", category: "Culture", icon: "🦄" },
  { fact_text: "A cloud can weigh more than a million pounds.", category: "Science", icon: "☁️" },
  { fact_text: "There's enough DNA in the human body to stretch from the Sun to Pluto and back 17 times.", category: "Biology", icon: "🧬" },
  { fact_text: "The dot over the letters 'i' and 'j' is called a tittle.", category: "Language", icon: "✍️" },
  { fact_text: "Wombat poop is cube-shaped.", category: "Nature", icon: "🦘" },
  { fact_text: "Hot water freezes faster than cold water in certain conditions.", category: "Physics", icon: "🧊" },
  { fact_text: "The moon is slowly drifting away from Earth at about 3.8 cm per year.", category: "Space", icon: "🌙" },
  { fact_text: "There are more stars in the universe than grains of sand on all of Earth's beaches.", category: "Space", icon: "⭐" },
  { fact_text: "A sneeze travels about 100 miles per hour.", category: "Biology", icon: "🤧" },
  { fact_text: "The shortest complete sentence in English is 'I am.'", category: "Language", icon: "📝" },
  { fact_text: "Dolphins sleep with one eye open.", category: "Nature", icon: "🐬" },
  { fact_text: "The Great Wall of China is not visible from space with the naked eye.", category: "History", icon: "🏯" },
  { fact_text: "A 'moment' was a medieval unit of time equal to 90 seconds.", category: "History", icon: "⏳" },
  { fact_text: "The average person walks the equivalent of three times around the world in a lifetime.", category: "Fun", icon: "🚶" },
  { fact_text: "Humans share 60% of their DNA with bananas.", category: "Biology", icon: "🧬" },
  { fact_text: "The first oranges weren't orange—they were green.", category: "Nature", icon: "🍊" },
  { fact_text: "A cockroach can live for a week without its head.", category: "Biology", icon: "🪳" },
  { fact_text: "The electric chair was invented by a dentist.", category: "History", icon: "🦷" },
  { fact_text: "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.", category: "History", icon: "👑" },
  { fact_text: "The total weight of ants on Earth equals the total weight of humans.", category: "Nature", icon: "🐜" },
  { fact_text: "A single strand of spaghetti is called a 'spaghetto'.", category: "Language", icon: "🍝" },
  { fact_text: "Venus is the only planet that spins clockwise.", category: "Space", icon: "🌍" },
  { fact_text: "The fingerprints of koalas are virtually indistinguishable from humans'.", category: "Nature", icon: "🐨" },
  { fact_text: "A group of owls is called a 'parliament'.", category: "Nature", icon: "🦉" },
  { fact_text: "The Empire State Building has its own zip code.", category: "Fun", icon: "🏙️" },
  { fact_text: "Astronauts cannot cry in space because tears don't fall.", category: "Space", icon: "🧑‍🚀" },
  { fact_text: "The human nose can detect over 1 trillion different scents.", category: "Biology", icon: "👃" },
  { fact_text: "A day on Mercury lasts 59 Earth days.", category: "Space", icon: "☿️" },
  { fact_text: "Elephants are the only animals that can't jump.", category: "Nature", icon: "🐘" },
  { fact_text: "The first computer programmer was a woman, Ada Lovelace.", category: "History", icon: "💻" },
  { fact_text: "Polar bear fur is not white—it's transparent.", category: "Nature", icon: "🐻‍❄️" },
  { fact_text: "A group of crows is called a 'murder'.", category: "Nature", icon: "🐦‍⬛" },
  { fact_text: "The Hawaiian alphabet has only 12 letters.", category: "Language", icon: "🌺" },
  { fact_text: "The oldest known living tree is over 5,000 years old.", category: "Nature", icon: "🌳" },
  { fact_text: "Sound travels about 4 times faster in water than in air.", category: "Physics", icon: "🔊" },
  { fact_text: "The speed of a computer mouse is measured in 'Mickeys'.", category: "Technology", icon: "🖱️" },
  { fact_text: "A hummingbird's heart beats up to 1,260 times per minute.", category: "Nature", icon: "🐦" },
  { fact_text: "The first alarm clock could only ring at 4 AM.", category: "History", icon: "⏰" },
  { fact_text: "Butterflies taste with their feet.", category: "Nature", icon: "🦋" },
  { fact_text: "A 'googol' is 1 followed by 100 zeros.", category: "Math", icon: "🔢" },
  { fact_text: "The longest English word without a vowel is 'rhythms'.", category: "Language", icon: "📖" },
  { fact_text: "Goldfish have a memory span of at least 3 months, not 3 seconds.", category: "Nature", icon: "🐠" },
  { fact_text: "The inventor of Vaseline ate a spoonful of it every day.", category: "Fun", icon: "🧴" },
  { fact_text: "Light from the Sun takes about 8 minutes to reach Earth.", category: "Space", icon: "☀️" },
  { fact_text: "The average person spends 6 months of their life waiting for red lights.", category: "Fun", icon: "🚦" },
  { fact_text: "An octopus has nine brains—one central and one in each arm.", category: "Biology", icon: "🧠" },
  { fact_text: "The largest snowflake ever recorded was 15 inches wide.", category: "Nature", icon: "❄️" },
  { fact_text: "Rats laugh when tickled.", category: "Nature", icon: "🐀" },
  { fact_text: "A 'zeptosecond' is a trillionth of a billionth of a second.", category: "Science", icon: "⚛️" },
  { fact_text: "The human brain uses about 20% of the body's total energy.", category: "Biology", icon: "🧠" },
  { fact_text: "Oxford University is older than the Aztec Empire.", category: "History", icon: "🏛️" },
  { fact_text: "A sneeze can produce up to 40,000 droplets.", category: "Biology", icon: "💨" },
  { fact_text: "The world's oldest piece of chewing gum is 9,000 years old.", category: "History", icon: "🫧" },
  { fact_text: "Bees can recognize human faces.", category: "Nature", icon: "🐝" },
  { fact_text: "The longest recorded flight of a chicken is 13 seconds.", category: "Fun", icon: "🐔" },
  { fact_text: "Water can boil and freeze at the same time under certain conditions.", category: "Physics", icon: "💧" },
  { fact_text: "The inventor of the chocolate chip cookie sold the idea for $1.", category: "History", icon: "🍪" },
  { fact_text: "There's a species of jellyfish that is biologically immortal.", category: "Biology", icon: "🪼" },
  { fact_text: "The original name for butterfly was 'flutterby'.", category: "Language", icon: "🦋" },
  { fact_text: "A blue whale's heart is the size of a small car.", category: "Nature", icon: "🐋" },
  { fact_text: "The first webcam was created to watch a coffee pot.", category: "Technology", icon: "☕" },
  { fact_text: "Human teeth are as strong as shark teeth.", category: "Biology", icon: "🦷" },
  { fact_text: "The shortest war in history was between Britain and Zanzibar in 1896.", category: "History", icon: "🏳️" },
  { fact_text: "Cats have over 20 different vocalizations, including the meow.", category: "Nature", icon: "🐱" },
  { fact_text: "A photon takes 40,000 years to travel from the sun's core to its surface.", category: "Physics", icon: "✨" },
  { fact_text: "The Mona Lisa has no eyebrows.", category: "Art", icon: "🖼️" },
  { fact_text: "Sloths can hold their breath longer than dolphins.", category: "Nature", icon: "🦥" },
  { fact_text: "The average cloud weighs 1.1 million pounds.", category: "Science", icon: "☁️" },
  { fact_text: "There's a basketball court on the top floor of the US Supreme Court building.", category: "Fun", icon: "🏀" },
  { fact_text: "A small child could swim through the veins of a blue whale.", category: "Nature", icon: "🐳" },
  { fact_text: "Humans are the only animals that blush.", category: "Biology", icon: "😊" },
  { fact_text: "The Twitter bird's official name is Larry.", category: "Technology", icon: "🐦" },
  { fact_text: "The inventor of the frisbee was turned into a frisbee after he died.", category: "Fun", icon: "🥏" },
  { fact_text: "A group of porcupines is called a 'prickle'.", category: "Nature", icon: "🦔" },
  { fact_text: "Your nose and ears never stop growing.", category: "Biology", icon: "👂" },
  { fact_text: "The first product to have a barcode was Wrigley's gum.", category: "History", icon: "📊" },
  { fact_text: "Neptune's moon Triton orbits in the opposite direction of the planet's rotation.", category: "Space", icon: "🌊" },
  { fact_text: "A 'jiffy' is scientifically defined as 1/100th of a second.", category: "Science", icon: "⚡" },
  { fact_text: "The Hawaiian pizza was invented in Canada.", category: "Fun", icon: "🍕" },
  { fact_text: "The longest time between two twins being born is 87 days.", category: "Biology", icon: "👶" },
  { fact_text: "The word 'nerd' was first coined by Dr. Seuss.", category: "Language", icon: "📚" },
  { fact_text: "A day on Pluto lasts 153 hours.", category: "Space", icon: "❄️" },
  { fact_text: "The first movie ever made was only 2.11 seconds long.", category: "History", icon: "🎬" },
  { fact_text: "A crocodile cannot stick its tongue out.", category: "Nature", icon: "🐊" },
  { fact_text: "The moon has moonquakes.", category: "Space", icon: "🌙" },
  { fact_text: "The first computer virus was created in 1983.", category: "Technology", icon: "🦠" },
  { fact_text: "Crows can remember human faces and hold grudges.", category: "Nature", icon: "🐦‍⬛" },
  { fact_text: "The strongest muscle in the human body is the masseter (jaw muscle).", category: "Biology", icon: "💪" },
  { fact_text: "A single bolt of lightning contains enough energy to toast 100,000 slices of bread.", category: "Science", icon: "🍞" },
  { fact_text: "The longest word you can type with only the left hand is 'stewardesses'.", category: "Language", icon: "⌨️" },
  { fact_text: "Cows have best friends and become stressed when separated.", category: "Nature", icon: "🐮" },
  { fact_text: "The first message sent over the internet was 'LO' (attempted 'LOGIN' but it crashed).", category: "Technology", icon: "📧" },
  { fact_text: "Ostriches can run faster than horses.", category: "Nature", icon: "🐎" },
  { fact_text: "The inventor of the Pringles can is buried in one.", category: "Fun", icon: "🥫" },
  { fact_text: "A single teaspoon of a neutron star would weigh about 6 billion tons.", category: "Space", icon: "⭐" },
  { fact_text: "The oldest known recipe is for beer.", category: "History", icon: "🍺" },
  { fact_text: "Sea otters hold hands while sleeping so they don't drift apart.", category: "Nature", icon: "🦦" },
  { fact_text: "The first domain name ever registered was Symbolics.com in 1985.", category: "Technology", icon: "🌐" },
  { fact_text: "A snail can sleep for three years.", category: "Nature", icon: "🐌" },
  { fact_text: "The largest living organism is a honey fungus in Oregon spanning 2.4 miles.", category: "Nature", icon: "🍄" },
  { fact_text: "The plastic tips on shoelaces are called 'aglets'.", category: "Language", icon: "👟" },
  { fact_text: "Bananas are radioactive.", category: "Science", icon: "☢️" },
  { fact_text: "The first smartphone was created in 1992, not 2007.", category: "Technology", icon: "📱" },
  { fact_text: "A strawberry isn't a berry, but a banana is.", category: "Nature", icon: "🍓" },
  { fact_text: "The Great Pyramid of Giza was the tallest structure for over 3,800 years.", category: "History", icon: "🏛️" },
  { fact_text: "Octopuses have copper-based blood, making it blue.", category: "Biology", icon: "🩸" },
  { fact_text: "The average person produces enough saliva in their lifetime to fill two swimming pools.", category: "Biology", icon: "🏊" },
  { fact_text: "A group of pandas is called an 'embarrassment'.", category: "Nature", icon: "🐼" },
  { fact_text: "The inventor of the Super Soaker was a NASA engineer.", category: "History", icon: "🔫" },
  { fact_text: "The longest hiccuping spree lasted 68 years.", category: "Fun", icon: "😵" },
  { fact_text: "Apples float because they are 25% air.", category: "Science", icon: "🍎" },
  { fact_text: "The average lightning bolt is only about an inch wide.", category: "Science", icon: "⚡" },
  { fact_text: "Pigeons can do math at a similar level to monkeys.", category: "Nature", icon: "🐦" },
  { fact_text: "The word 'set' has the most definitions of any English word.", category: "Language", icon: "📖" },
  { fact_text: "A jiffy is 1/100th of a second.", category: "Science", icon: "⏱️" },
  { fact_text: "Horses can't vomit.", category: "Nature", icon: "🐴" },
  { fact_text: "The average person spends 2 weeks of their lifetime waiting for traffic lights.", category: "Fun", icon: "🚗" },
  { fact_text: "The code name for the iPhone was 'Purple'.", category: "Technology", icon: "💜" },
  { fact_text: "A group of rhinos is called a 'crash'.", category: "Nature", icon: "🦏" },
  { fact_text: "The moon is moving away from Earth at 3.8 centimeters per year.", category: "Space", icon: "🌕" },
  { fact_text: "There are more public libraries in the US than McDonald's.", category: "Fun", icon: "📚" },
  { fact_text: "The longest wedding veil was longer than 63 football fields.", category: "Fun", icon: "👰" },
  { fact_text: "A 'googol' inspired the name 'Google'.", category: "Technology", icon: "🔍" },
  { fact_text: "Honey is the only food that never spoils.", category: "Science", icon: "🍯" },
  { fact_text: "Astronauts grow up to 2 inches taller in space.", category: "Space", icon: "📏" },
  { fact_text: "The unicorn is Scotland's national animal.", category: "Culture", icon: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { fact_text: "A 'moment' in medieval times was exactly 90 seconds.", category: "History", icon: "⌛" },
  { fact_text: "The Eiffel Tower leans slightly towards the shade on sunny days.", category: "Physics", icon: "🗼" },
  { fact_text: "Dolphins can stay awake for 15 days straight.", category: "Nature", icon: "🐬" },
  { fact_text: "The first oranges weren't orange—they were green.", category: "Nature", icon: "🍊" },
  { fact_text: "A bolt of lightning can reach temperatures of 30,000 Kelvin.", category: "Physics", icon: "🌩️" },
  { fact_text: "The word 'checkmate' comes from the Persian phrase 'shah mat,' meaning 'the king is dead.'", category: "Language", icon: "♚" },
  { fact_text: "Your brain uses 20% of your total oxygen and calorie intake.", category: "Biology", icon: "🧠" },
  { fact_text: "The inventor of the matches died from phosphorus poisoning.", category: "History", icon: "🔥" },
  { fact_text: "A cat's nose print is unique, like a human fingerprint.", category: "Nature", icon: "🐱" },
  { fact_text: "The first YouTube video was uploaded on April 23, 2005.", category: "Technology", icon: "▶️" },
  { fact_text: "A group of jellyfish is called a 'smack'.", category: "Nature", icon: "🪼" },
  { fact_text: "The shortest complete sentence in English is 'Go.'", category: "Language", icon: "📝" },
  { fact_text: "Humans can distinguish between more than 1 trillion smells.", category: "Biology", icon: "👃" },
  { fact_text: "The first computer mouse was made of wood.", category: "Technology", icon: "🪵" },
  { fact_text: "A flea can jump 350 times its body length.", category: "Nature", icon: "🦗" },
  { fact_text: "The average human body contains enough iron to make a 3-inch nail.", category: "Biology", icon: "🔩" },
  { fact_text: "The original iPod prototype was rejected because it was too big.", category: "Technology", icon: "🎵" },
  { fact_text: "Flamingos are born gray and turn pink from their diet.", category: "Nature", icon: "🦩" },
  { fact_text: "The first email was sent in 1971.", category: "Technology", icon: "📨" },
  { fact_text: "A giraffe's spots are like human fingerprints—no two are alike.", category: "Nature", icon: "🦒" },
  { fact_text: "The average person will spend 6 months of their life waiting in line.", category: "Fun", icon: "🚶" },
  { fact_text: "Pluto is smaller than Russia.", category: "Space", icon: "🪐" },
  { fact_text: "The first domain name ever registered was symbolics.com.", category: "Technology", icon: "🌐" },
  { fact_text: "A group of flamingos is called a 'flamboyance.'", category: "Nature", icon: "🦩" },
  { fact_text: "The Sahara Desert can fit inside the United States.", category: "Geography", icon: "🏜️" },
  { fact_text: "A single cloud can weigh more than 1 million pounds.", category: "Science", icon: "☁️" },
  { fact_text: "The infinity symbol is called a 'lemniscate.'", category: "Math", icon: "∞" },
  { fact_text: "Koalas sleep up to 22 hours a day.", category: "Nature", icon: "😴" },
  { fact_text: "The word 'robot' comes from the Czech word 'robota,' meaning forced labor.", category: "Language", icon: "🤖" },
  { fact_text: "A single pencil can draw a line 35 miles long.", category: "Fun", icon: "✏️" },
  { fact_text: "The first text message was sent in 1992 and said 'Merry Christmas.'", category: "Technology", icon: "📱" },
  { fact_text: "A hippopotamus can run faster than a human.", category: "Nature", icon: "🦛" },
  { fact_text: "The lighter was invented before the match.", category: "History", icon: "🔥" },
  { fact_text: "Spiders can't fly, but they can 'balloon' through the air using silk threads.", category: "Nature", icon: "🕷️" },
  { fact_text: "The first webcam watched a coffee pot at Cambridge University.", category: "Technology", icon: "☕" },
  { fact_text: "Butterflies can see more colors than humans.", category: "Nature", icon: "🦋" },
  { fact_text: "The average cloud travels at about 30-40 mph.", category: "Science", icon: "💨" },
  { fact_text: "A group of hedgehogs is called a 'prickle.'", category: "Nature", icon: "🦔" },
  { fact_text: "The first known recipe is for beer, dating back to 1800 BCE.", category: "History", icon: "🍻" },
  { fact_text: "Starfish don't have brains.", category: "Nature", icon: "⭐" },
  { fact_text: "The hashtag symbol is technically called an 'octothorpe.'", category: "Language", icon: "#️⃣" },
  { fact_text: "A day on Mars is about 24 hours and 37 minutes.", category: "Space", icon: "🔴" },
  { fact_text: "The first 3D movie was released in 1922.", category: "History", icon: "🎥" },
  { fact_text: "Octopuses have three hearts.", category: "Nature", icon: "❤️" },
  { fact_text: "The longest word without a true vowel is 'rhythm.'", category: "Language", icon: "🎼" },
  { fact_text: "Peanuts are not nuts—they're legumes.", category: "Science", icon: "🥜" },
  { fact_text: "The moon's gravity causes Earth to have tides.", category: "Physics", icon: "🌊" },
  { fact_text: "A 'baker's dozen' is 13 because bakers used to add an extra to avoid penalties for short-changing.", category: "History", icon: "🥖" },
  { fact_text: "Humans share 50% of their DNA with bananas.", category: "Biology", icon: "🍌" },
  { fact_text: "The first animated feature film was made in Argentina in 1917.", category: "History", icon: "🎬" },
  { fact_text: "An eagle can spot a rabbit from over a mile away.", category: "Nature", icon: "🦅" },
  { fact_text: "The speed of light is exactly 299,792,458 meters per second.", category: "Physics", icon: "💡" },
  { fact_text: "A 'fortnight' means 14 nights.", category: "Language", icon: "🌙" },
  { fact_text: "The Amazon rainforest produces 20% of the world's oxygen.", category: "Nature", icon: "🌳" },
  { fact_text: "The first computer bug was an actual moth.", category: "Technology", icon: "🦋" },
  { fact_text: "Water covers about 71% of Earth's surface.", category: "Geography", icon: "🌍" },
  { fact_text: "The average person laughs about 15 times a day.", category: "Fun", icon: "😂" },
  { fact_text: "A group of cats is called a 'clowder.'", category: "Nature", icon: "🐱" },
  { fact_text: "The first selfie was taken in 1839.", category: "History", icon: "🤳" },
  { fact_text: "The human eye can distinguish about 10 million different colors.", category: "Biology", icon: "👁️" },
  { fact_text: "The shortest flight in the world lasts about 57 seconds.", category: "Fun", icon: "✈️" }
];

import { useTheme } from "@/components/theme/ThemeProvider";

export default function EducationalLoader({ title = "Creating Your Lesson", description = "Our AI is analyzing the curriculum and generating personalized content..." }) {
  const { isDark } = useTheme();
  const [currentFact, setCurrentFact] = useState(null);
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    // Shuffle and pick initial fact
    const shuffled = [...FUN_FACTS].sort(() => Math.random() - 0.5);
    setCurrentFact(shuffled[0]);
    
    // Rotate through facts
    const timer = setInterval(() => {
      setFactIndex(prev => {
        const next = (prev + 1) % shuffled.length;
        setCurrentFact(shuffled[next]);
        return next;
      });
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      {/* Animated loader */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full blur-xl opacity-30 animate-pulse" />
        <div className="relative w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center shadow-xl">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      </div>

      {/* Title */}
      <h2 className={`text-lg font-bold mb-1 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {title}
      </h2>
      <p className={`text-sm mb-6 text-center max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {description}
      </p>

      {/* Divider */}
      <div className={`h-px w-full bg-gradient-to-r from-transparent ${isDark ? 'via-slate-700' : 'via-slate-200'} to-transparent mb-6`} />

      {/* Fun fact card */}
      <div className="min-h-[120px] w-full flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {currentFact && (
            <motion.div
              key={currentFact.fact_text}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center space-y-3"
            >
              <span className="text-4xl">{currentFact.icon || "💡"}</span>
              
              <div className="space-y-2">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500/20 to-rose-500/20 text-pink-400 border border-pink-500/30">
                  {currentFact.category || "Fun Fact"}
                </span>
                <p className={`text-sm font-medium leading-relaxed max-w-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {currentFact.fact_text}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 mt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i === factIndex % 3 ? 'bg-pink-500' : (isDark ? 'bg-slate-600' : 'bg-slate-200')
            }`}
          />
        ))}
      </div>
    </div>
  );
}