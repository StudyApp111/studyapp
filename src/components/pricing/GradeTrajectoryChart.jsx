import React from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

const GRADE_THRESHOLDS = [
  { grade: "A+", min: 95 },
  { grade: "A",  min: 90 },
  { grade: "A-", min: 85 },
  { grade: "B+", min: 80 },
  { grade: "B",  min: 75 },
  { grade: "B-", min: 70 },
  { grade: "C+", min: 65 },
  { grade: "C",  min: 60 },
  { grade: "C-", min: 55 },
  { grade: "D+", min: 50 },
  { grade: "D",  min: 45 },
  { grade: "D-", min: 40 },
  { grade: "F",  min: 0 },
];

const gradeFromValue = (val) => {
  for (const { grade, min } of GRADE_THRESHOLDS) {
    if (val >= min) return grade;
  }
  return "F";
};

// Y-axis: pick ~5 evenly spaced labels based on the data range
const pickYAxisLabels = (minVal, maxVal) => {
  const labels = [];
  // Show a label roughly every 15-20 points
  const step = Math.max(10, Math.ceil((maxVal - minVal) / 5 / 5) * 5);
  for (let v = Math.ceil(minVal / step) * step; v <= maxVal; v += step) {
    labels.push({ value: v, label: gradeFromValue(v) + ` (${v}%)` });
  }
  return labels;
};

export default function GradeTrajectoryChart({ currentGrade, currentScore, gradeHistory }) {
  // Convert grade to approximate score if no currentScore provided
  const gradeToScore = (grade) => {
    const entry = GRADE_THRESHOLDS.find(t => t.grade === grade);
    return entry ? entry.min + 2 : 50;
  };
  const startVal = currentScore || gradeToScore(currentGrade) || 50;
  const targetVal = 97; // A+

  // Build data points: current → projected milestones → A+
  const points = [];

  // Add history points if available
  if (gradeHistory?.length > 0) {
    gradeHistory.forEach((h, i) => {
      points.push({ label: i === gradeHistory.length - 1 ? "Current" : `Past`, value: h.score || gradeToScore(h.predicted_grade) || 50, type: "history" });
    });
  } else {
    points.push({ label: "Current", value: startVal, type: "current" });
  }

  // Generate projected milestones toward A+
  const lastVal = points[points.length - 1].value;
  const gap = targetVal - lastVal;
  if (gap > 5) {
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      const projVal = Math.round(lastVal + (gap * i) / (steps + 1));
      points.push({ label: `Week ${i}`, value: projVal, type: "projected" });
    }
  }
  points.push({ label: "Target", value: targetVal, type: "target" });

  // SVG dimensions
  const W = 320;
  const H = 140;
  const padX = 30;
  const padTop = 20;
  const padBottom = 20;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBottom;

  // Dynamic scale: pad 5% below lowest and 5% above highest
  const lowestDataPoint = Math.min(...points.map(p => p.value));
  const minVal = Math.max(0, lowestDataPoint - 5);
  const maxVal = 100;

  const getX = (i) => padX + (i / (points.length - 1)) * chartW;
  const getY = (val) => {
    const clampedVal = Math.max(minVal, Math.min(maxVal, val));
    return padTop + chartH - ((clampedVal - minVal) / (maxVal - minVal)) * chartH;
  };

  // Solid path for history/current
  const solidPoints = points.filter((p) => p.type !== "projected" && p.type !== "target");
  const dashedPoints = points.filter((p) => p.type === "projected" || p.type === "target");
  const lastSolidIdx = solidPoints.length - 1;

  // Build path strings
  const solidPath = solidPoints.map((p, i) => {
    const idx = points.indexOf(p);
    return `${i === 0 ? "M" : "L"}${getX(idx)},${getY(p.value)}`;
  }).join(" ");

  const dashedStartIdx = points.indexOf(solidPoints[solidPoints.length - 1]);
  const dashedPath = [solidPoints[solidPoints.length - 1], ...dashedPoints]
    .map((p, i) => {
      const idx = i === 0 ? dashedStartIdx : points.indexOf(p);
      return `${i === 0 ? "M" : "L"}${getX(idx)},${getY(p.value)}`;
    })
    .join(" ");

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
          Your Projected Grade Trajectory
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines with grade labels at evenly spaced intervals */}
        {pickYAxisLabels(minVal, maxVal).map(({ value, label }) => (
          <g key={value}>
            <line
              x1={padX}
              y1={getY(value)}
              x2={W - padX}
              y2={getY(value)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
            />
            <text x={padX - 4} y={getY(value) + 3} textAnchor="end" className="fill-purple-300/40" fontSize="6">
              {gradeFromValue(value)}
            </text>
          </g>
        ))}

        {/* Solid line (actual data) */}
        {solidPoints.length > 1 && (
          <motion.path
            d={solidPath}
            fill="none"
            stroke="url(#solidGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        )}

        {/* Dashed line (projection) */}
        <motion.path
          d={dashedPath}
          fill="none"
          stroke="url(#dashedGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 4"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
        />

        {/* Gradient defs */}
        <defs>
          <linearGradient id="solidGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="dashedGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Data points */}
        {points.map((p, i) => {
          const cx = getX(i);
          const cy = getY(p.value);
          const isTarget = p.type === "target";
          const isProjected = p.type === "projected";

          return (
            <g key={i}>
              {/* Glow for target */}
              {isTarget && (
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r="8"
                  fill="rgba(16, 185, 129, 0.2)"
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <motion.circle
                cx={cx}
                cy={cy}
                r={isTarget ? 5 : 3.5}
                fill={isTarget ? "#10b981" : isProjected ? "#22c55e" : "#f59e0b"}
                stroke={isTarget ? "#064e3b" : "none"}
                strokeWidth={isTarget ? 1.5 : 0}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.15 }}
              />
              {/* Labels — show grade for current/target, percentage for projected */}
              <text
                x={cx}
                y={cy - 8}
                textAnchor="middle"
                fontSize="8"
                fontWeight="bold"
                className={isTarget ? "fill-emerald-400" : isProjected ? "fill-emerald-300/70" : "fill-amber-400"}
              >
                {isProjected ? `${Math.round(p.value)}%` : gradeFromValue(p.value)}
              </text>
              <text
                x={cx}
                y={H - 4}
                textAnchor="middle"
                fontSize="6"
                className="fill-purple-300/50"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="text-center text-purple-300/50 text-[10px] mt-1">
        With Pro, students improve an average of 2 letter grades
      </p>
    </div>
  );
}