import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Legacy onboarding page — redirects to Home where the new onboarding modal lives
export default function Onboarding() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(createPageUrl("Home"), { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
    </div>
  );
}