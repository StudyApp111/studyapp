import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check } from "lucide-react";

export default function PricingPlans() {
  const navigate = useNavigate();

  const features = [
    "AI-powered diagnostic quizzes",
    "Personalized adaptive worksheets",
    "Smart assignment grading",
    "Real-time performance analytics",
    "Learning pattern insights",
    "Predicted exam scores",
    "Global leaderboard & gamification",
    "Streak tracking & achievements",
    "Multi-format file support (PDF, DOCX, images)",
    "Comprehensive feedback reports",
    "Progress tracking across lessons"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Settings"))}
          className="mb-6 hover:bg-purple-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Settings
        </Button>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            StudyApp.AI is <span className="text-purple-600">100% Free</span>
          </h1>
          <div className="inline-block bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-full shadow-lg mb-4">
            <p className="text-lg font-semibold">Free until December 31, 2025</p>
          </div>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Get full access to all premium features at no cost. Experience AI-powered learning without any limitations.
          </p>
        </div>

        <Card className="shadow-2xl border-0 max-w-3xl mx-auto">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="text-3xl mb-2">Full Feature Access</CardTitle>
            <p className="text-purple-100">Everything you need to excel in your studies</p>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 mb-8">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-slate-700 leading-relaxed">{feature}</span>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
              <h3 className="text-xl font-bold text-slate-900 mb-3 text-center">What Happens After December 31, 2025?</h3>
              <p className="text-slate-700 text-center leading-relaxed">
                Pricing details for 2026 will be announced later this year. Early users will receive special benefits and discounts as a thank you for being part of our journey.
              </p>
            </div>

            <div className="mt-6 text-center">
              <Button
                onClick={() => navigate(createPageUrl("Home"))}
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 px-8 py-6 text-lg"
                size="lg"
              >
                Start Learning Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}