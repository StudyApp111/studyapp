import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Trophy, Award, Flame, Zap, Star, Target, BookOpen, TrendingUp } from "lucide-react";

const BADGE_ICONS = {
  first_lesson: BookOpen,
  perfect_score: Trophy,
  grade_a: Award,
  five_worksheets: Target,
  ten_worksheets: Star,
  seven_day_streak: Flame,
  thirty_day_streak: Flame,
  speed_demon: Zap,
  consistent_learner: TrendingUp
};

export default function BadgeDisplay({ badges, size = "default" }) {
  if (!badges || badges.length === 0) {
    return null;
  }

  const isCompact = size === "compact";

  return (
    <div className={`grid ${isCompact ? 'grid-cols-3 gap-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'}`}>
      {badges.map((badge, idx) => {
        const IconComponent = BADGE_ICONS[badge.badge_id] || Award;
        
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ scale: 1.05 }}
          >
            <Card className={`${isCompact ? 'p-2' : 'p-4'} bg-gradient-to-br from-purple-50 to-yellow-50 border-2 border-purple-200 hover:shadow-lg transition-all`}>
              <div className="flex flex-col items-center text-center gap-2">
                <div className={`${isCompact ? 'w-10 h-10' : 'w-16 h-16'} bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center shadow-lg`}>
                  <IconComponent className={`${isCompact ? 'w-5 h-5' : 'w-8 h-8'} text-yellow-400`} />
                </div>
                <div>
                  <h4 className={`${isCompact ? 'text-xs' : 'text-sm'} font-bold text-slate-900`}>{badge.badge_name}</h4>
                  {!isCompact && (
                    <p className="text-xs text-slate-600 mt-1">{badge.badge_description}</p>
                  )}
                </div>
                {!isCompact && (
                  <Badge variant="outline" className="text-xs">
                    {new Date(badge.earned_date).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}