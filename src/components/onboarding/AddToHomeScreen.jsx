import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smartphone, Share, Plus, MoreVertical, Download, Home, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function AddToHomeScreen({ onContinue }) {
  const [deviceInfo, setDeviceInfo] = useState({
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    isMobile: false
  });

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
    const isFirefox = /firefox/.test(userAgent);
    const isMobile = /mobile|android|iphone|ipad|ipod/.test(userAgent);

    setDeviceInfo({
      isIOS,
      isAndroid,
      isSafari,
      isChrome,
      isFirefox,
      isMobile
    });
  }, []);

  const getInstructions = () => {
    if (deviceInfo.isIOS && deviceInfo.isSafari) {
      return {
        icon: Share,
        steps: [
          { text: "Tap the Share button", icon: Share, detail: "at the bottom of your screen" },
          { text: "Scroll down and tap 'Add to Home Screen'", icon: Plus, detail: "" },
          { text: "Tap 'Add' in the top right", icon: Home, detail: "and you're done!" }
        ]
      };
    } else if (deviceInfo.isIOS && deviceInfo.isChrome) {
      return {
        icon: Share,
        steps: [
          { text: "Tap the Share button", icon: Share, detail: "at the bottom of your screen" },
          { text: "Scroll and tap 'Add to Home Screen'", icon: Plus, detail: "" },
          { text: "Tap 'Add' to confirm", icon: Home, detail: "" }
        ]
      };
    } else if (deviceInfo.isAndroid && deviceInfo.isChrome) {
      return {
        icon: MoreVertical,
        steps: [
          { text: "Tap the menu (three dots)", icon: MoreVertical, detail: "in the top right corner" },
          { text: "Tap 'Add to Home screen'", icon: Plus, detail: "" },
          { text: "Tap 'Add' to confirm", icon: Home, detail: "and you're done!" }
        ]
      };
    } else if (deviceInfo.isAndroid) {
      return {
        icon: MoreVertical,
        steps: [
          { text: "Tap your browser menu", icon: MoreVertical, detail: "(usually three dots or lines)" },
          { text: "Look for 'Add to Home screen'", icon: Plus, detail: "or 'Install app'" },
          { text: "Tap 'Add' or 'Install'", icon: Home, detail: "" }
        ]
      };
    } else {
      return {
        icon: Smartphone,
        steps: [
          { text: "Open your browser menu", icon: MoreVertical, detail: "" },
          { text: "Look for 'Add to Home screen'", icon: Plus, detail: "" },
          { text: "Follow the prompts", icon: Home, detail: "" }
        ]
      };
    }
  };

  const instructions = getInstructions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          {/* Header with Icon */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-yellow-500 rounded-2xl blur-xl opacity-50" />
              <div className="relative bg-gradient-to-br from-purple-600 to-yellow-500 p-4 rounded-2xl shadow-lg">
                <Smartphone className="w-12 h-12 text-white" />
              </div>
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="w-6 h-6 text-yellow-500" />
              </motion.div>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Save StudyApp like an app
            </h2>
            <p className="text-slate-600 text-sm">
              No download required — access instantly from your home screen
            </p>
          </motion.div>

          {/* Instructions */}
          <div className="space-y-4 mb-8">
            {instructions.steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <div className="flex gap-4 items-start p-4 rounded-xl bg-gradient-to-r from-slate-50 to-purple-50/30 border border-slate-200 hover:border-purple-300 transition-colors">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-yellow-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StepIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <p className="font-semibold text-slate-900 text-sm">
                          {step.text}
                        </p>
                      </div>
                      {step.detail && (
                        <p className="text-xs text-slate-600">
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Benefits */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-r from-purple-100 to-yellow-100 rounded-xl p-4 mb-6 border border-purple-200"
          >
            <p className="text-sm text-center text-slate-700">
              ✨ <span className="font-semibold">Quick access</span> • 📱 <span className="font-semibold">Native feel</span> • 🚀 <span className="font-semibold">Instant launch</span>
            </p>
          </motion.div>

          {/* Continue Button */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Button
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-semibold py-6 text-base shadow-lg"
            >
              Continue to StudyApp
            </Button>
            <p className="text-xs text-center text-slate-500 mt-3">
              You can always add it later from your browser menu
            </p>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}