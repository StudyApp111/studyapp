import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function StatCard({ title, value, icon: Icon, gradient, trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-shadow h-full">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
        <CardContent className="p-6 relative h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-2">{title}</p>
              <p className="text-3xl font-bold text-slate-900">{value}</p>
            </div>
            <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg flex items-center justify-center`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
          {trend && (
            <p className="text-xs text-slate-500 font-medium mt-auto">{trend}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}