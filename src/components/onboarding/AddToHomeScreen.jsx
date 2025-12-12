import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smartphone, Share, Plus, MoreVertical, Download, Home, Sparkles, ArrowUp, Square } from "lucide-react";
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

  // iOS Safari Share icon (box with arrow up)
  const IOSShareIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M12 3v12m0-12l-4 4m4-4l4 4" />
    </svg>
  );

  // iOS Add to Home icon (plus in square)
  const IOSAddIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8m-4-4h8" />
    </svg>
  );

  const getInstructions = () => {
    if (deviceInfo.isIOS && deviceInfo.isSafari) {
      return {
        arrowPosition: "bottom",
        steps: [
          { 
            text: "Tap the Share button", 
            detail: "(box with arrow at bottom center)",
            CustomIcon: IOSShareIcon,
            showArrow: true,
            arrowDirection: "down"
          },
          { 
            text: "Scroll down and tap 'Add to Home Screen'",
            detail: "(look for the plus icon)",
            CustomIcon: IOSAddIcon,
            showArrow: false
          },
          { 
            text: "Tap 'Add' in the top right",
            detail: "and you're all set!",
            icon: null,
            showArrow: false
          }
        ]
      };
    } else if (deviceInfo.isIOS && deviceInfo.isChrome) {
      return {
        arrowPosition: "bottom",
        steps: [
          { 
            text: "Tap the Share button",
            detail: "(at the bottom of your screen)",
            CustomIcon: IOSShareIcon,
            showArrow: true,
            arrowDirection: "down"
          },
          { 
            text: "Scroll and tap 'Add to Home Screen'",
            detail: "",
            CustomIcon: IOSAddIcon,
            showArrow: false
          },
          { 
            text: "Tap 'Add' to confirm",
            detail: "",
            icon: null,
            showArrow: false
          }
        ]
      };
    } else if (deviceInfo.isAndroid && deviceInfo.isChrome) {
      return {
        arrowPosition: "top",
        steps: [
          { 
            text: "Tap the three dots menu",
            detail: "(⋮ at top right corner)",
            icon: MoreVertical,
            showArrow: true,
            arrowDirection: "up"
          },
          { 
            text: "Tap 'Add to Home screen'",
            detail: "(with a plus icon)",
            icon: Plus,
            showArrow: false
          },
          { 
            text: "Tap 'Add' to confirm",
            detail: "and you're all set!",
            icon: null,
            showArrow: false
          }
        ]
      };
    } else if (deviceInfo.isAndroid) {
      return {
        arrowPosition: "top",
        steps: [
          { 
            text: "Tap your browser menu",
            detail: "(three dots or lines at top)",
            icon: MoreVertical,
            showArrow: true,
            arrowDirection: "up"
          },
          { 
            text: "Look for 'Add to Home screen'",
            detail: "or 'Install app'",
            icon: Plus,
            showArrow: false
          },
          { 
            text: "Tap 'Add' or 'Install'",
            detail: "",
            icon: null,
            showArrow: false
          }
        ]
      };
    } else {
      return {
        arrowPosition: "top",
        steps: [
          { 
            text: "Open your browser menu",
            detail: "",
            icon: MoreVertical,
            showArrow: false
          },
          { 
            text: "Look for 'Add to Home screen'",
            detail: "",
            icon: Plus,
            showArrow: false
          },
          { 
            text: "Follow the prompts",
            detail: "",
            icon: null,
            showArrow: false
          }
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
            className="text-center mb-6"
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
            <p className="text-slate-600 text-sm mb-4">
              No download required — access instantly from your home screen
            </p>
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-xs font-semibold">
              Follow these 3 steps ↓
            </div>
          </motion.div>

          {/* Visual Arrow Indicator */}
          {instructions.steps[0]?.showArrow && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={`${instructions.arrowPosition === 'bottom' ? 'mb-4' : 'mb-4'}`}
            >
              <div className={`relative ${instructions.arrowPosition === 'bottom' ? 'mb-2' : 'mb-2'}`}>
                <motion.div
                  animate={{ 
                    y: instructions.arrowPosition === 'bottom' ? [0, 10, 0] : [0, -10, 0]
                  }}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className={`flex justify-${instructions.arrowPosition === 'bottom' ? 'center' : 'end'} ${instructions.arrowPosition === 'bottom' ? '' : 'pr-8'}`}
                >
                  <div className="text-yellow-600">
                    {instructions.arrowPosition === 'bottom' ? (
                      <ArrowUp className="w-8 h-8 transform rotate-180" strokeWidth={3} />
                    ) : (
                      <ArrowUp className="w-8 h-8" strokeWidth={3} />
                    )}
                  </div>
                </motion.div>
                <p className={`text-xs font-semibold text-yellow-700 text-${instructions.arrowPosition === 'bottom' ? 'center' : 'right'} ${instructions.arrowPosition === 'bottom' ? '' : 'pr-6'}`}>
                  Look here!
                </p>
              </div>
            </motion.div>
          )}

          {/* Instructions - Step by Step */}
          <div className="space-y-3 mb-8">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Follow these steps in order:
            </div>
            {instructions.steps.map((step, index) => {
              const StepIcon = step.icon;
              const CustomIcon = step.CustomIcon;
              return (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.15 }}
                  className="relative"
                >
                  {/* Connecting line */}
                  {index < instructions.steps.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-8 bg-gradient-to-b from-purple-300 to-yellow-300" />
                  )}
                  
                  <div className="flex gap-4 items-start p-4 rounded-xl bg-white border-2 border-slate-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-yellow-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg bg-purple-50">
                          {CustomIcon ? (
                            <CustomIcon />
                          ) : StepIcon ? (
                            <StepIcon className="w-5 h-5 text-purple-600" />
                          ) : (
                            <div className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 text-base leading-tight">
                            {step.text}
                          </p>
                          {step.detail && (
                            <p className="text-sm text-slate-600 mt-1">
                              {step.detail}
                            </p>
                          )}
                        </div>
                      </div>
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