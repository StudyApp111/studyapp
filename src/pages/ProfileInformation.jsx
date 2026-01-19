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

export default function ProfileInformation() {
  const navigate = useNavigate();
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

        if (currentUser.learning_profile_id) {
          const profiles = await base44.entities.LearningProfile.filter({
            id: currentUser.learning_profile_id
          });
          if (profiles.length > 0) {
            const profile = profiles[0];
            setLearningProfile(profile);
            setSchool(profile.school || "");
            setGrade(profile.grade || "");
            setCity(profile.city || "");
            setCountry(profile.country || "");
          }
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
      // Update user name
      await base44.auth.updateMe({ full_name: fullName });

      // Update or create learning profile
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-10">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Settings"))}
          className="mb-4 hover:bg-purple-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Settings
        </Button>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Profile Information</h1>

        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Alert className={message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              {message.type === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
              <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                {message.text}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        <div className="space-y-4">
          {/* Personal Details Card */}
          <Card className="shadow-lg border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-purple-600" />
                Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-slate-100"
                />
                <p className="text-xs text-slate-500">Email cannot be changed</p>
              </div>
            </CardContent>
          </Card>

          {/* Learning Profile Card */}
          <Card className="shadow-lg border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="w-5 h-5 text-purple-600" />
                Learning Profile
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Help us personalize your study experience
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="school" className="flex items-center gap-2">
                    <School className="w-4 h-4 text-slate-400" />
                    School
                  </Label>
                  <Input
                    id="school"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="e.g., Lincoln High School"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grade" className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-slate-400" />
                    Grade / Year
                  </Label>
                  <Input
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g., Grade 11, Year 2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    City
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Toronto"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    Country
                  </Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g., Canada"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button - Fixed at bottom on mobile */}
          <div className="pb-28 md:pb-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 shadow-lg"
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