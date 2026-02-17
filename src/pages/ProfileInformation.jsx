import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, User, GraduationCap, MapPin, School, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function ProfileInformation() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [learningProfile, setLearningProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setFullName(currentUser.full_name || "");
        setEmail(currentUser.email || "");

        // Try loading by learning_profile_id first, then fallback to listing by user
        let profiles = [];
        if (currentUser.learning_profile_id) {
          profiles = await base44.entities.LearningProfile.filter({
            id: currentUser.learning_profile_id
          });
        }
        if (profiles.length === 0) {
          profiles = await base44.entities.LearningProfile.list('-created_date', 1);
        }
        if (profiles.length > 0) {
          const profile = profiles[0];
          setLearningProfile(profile);
          setSchool(profile.school || "");
          setGrade(profile.grade || "");
          setCity(profile.city || "");
          setCountry(profile.country || "");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    
    try {
      await base44.auth.updateMe({ full_name: fullName });

      const profileData = { school, grade, city, country };
      
      if (learningProfile) {
        await base44.entities.LearningProfile.update(learningProfile.id, profileData);
      } else {
        const newProfile = await base44.entities.LearningProfile.create(profileData);
        await base44.auth.updateMe({ learning_profile_id: newProfile.id });
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: "error", text: "Error updating profile. Please try again." });
    }
    setIsSaving(false);
  };

  const inputClass = `${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`;
  const labelClass = `${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const labelIconClass = `w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a12]' : 'bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40'} p-4 md:p-10 pb-28 md:pb-10`}>
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Settings"))}
          className={`mb-4 ${isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-purple-100 text-slate-700'}`}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Settings
        </Button>

        <h1 className={`text-2xl md:text-3xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Profile Information</h1>

        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Alert className={message.type === "success" 
              ? (isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-green-50 border-green-200") 
              : (isDark ? "bg-red-500/10 border-red-500/30" : "bg-red-50 border-red-200")}>
              {message.type === "success" && <CheckCircle className={`h-4 w-4 ${isDark ? 'text-emerald-400' : 'text-green-600'}`} />}
              <AlertDescription className={message.type === "success" 
                ? (isDark ? "text-emerald-300" : "text-green-800") 
                : (isDark ? "text-red-300" : "text-red-800")}>
                {message.text}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        <div className="space-y-4">
          <Card className={`shadow-lg ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-0'}`}>
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-2 text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <User className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className={labelClass}>Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className={labelClass}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className={`${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 text-slate-600'}`}
                />
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Email cannot be changed</p>
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-lg ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-0'}`}>
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-2 text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <GraduationCap className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                Learning Profile
              </CardTitle>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Help us personalize your study experience
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="school" className={`flex items-center gap-2 ${labelClass}`}>
                    <School className={labelIconClass} />
                    School
                  </Label>
                  <Input
                    id="school"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="e.g., Lincoln High School"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grade" className={`flex items-center gap-2 ${labelClass}`}>
                    <GraduationCap className={labelIconClass} />
                    Grade / Year
                  </Label>
                  <Input
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g., Grade 11, Year 2"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className={`flex items-center gap-2 ${labelClass}`}>
                    <MapPin className={labelIconClass} />
                    City
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Toronto"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country" className={`flex items-center gap-2 ${labelClass}`}>
                    <MapPin className={labelIconClass} />
                    Country
                  </Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g., Canada"
                    className={inputClass}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="pb-28 md:pb-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 shadow-lg text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}