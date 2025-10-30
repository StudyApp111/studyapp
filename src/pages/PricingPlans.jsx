import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check } from "lucide-react";

export default function PricingPlans() {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      features: [
        "3 lessons per month",
        "Basic AI analysis",
        "Email support"
      ],
      current: true
    },
    {
      name: "Pro",
      price: "$19",
      period: "per month",
      features: [
        "Unlimited lessons",
        "Advanced AI analysis",
        "Priority support",
        "Detailed performance tracking",
        "Export reports"
      ],
      popular: true
    },
    {
      name: "Team",
      price: "$49",
      period: "per month",
      features: [
        "Everything in Pro",
        "Up to 10 students",
        "Admin dashboard",
        "Custom branding",
        "API access"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Settings"))}
          className="mb-6 hover:bg-purple-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Settings
        </Button>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Pricing Plans</h1>
          <p className="text-slate-600 text-lg">Choose the plan that's right for you</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, idx) => (
            <Card key={idx} className={`shadow-xl border-0 relative ${plan.popular ? 'ring-2 ring-purple-600' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="bg-purple-600 text-white">Most Popular</Badge>
                </div>
              )}
              {plan.current && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="bg-emerald-600 text-white">Current Plan</Badge>
                </div>
              )}
              <CardHeader className="pt-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-600 ml-2">/ {plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${
                    plan.current 
                      ? 'bg-slate-200 text-slate-600 cursor-default' 
                      : 'bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900'
                  }`}
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}