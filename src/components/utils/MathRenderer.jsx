import React from "react";

// LaTeX/Math rendering component for inline and block math
export const renderMathContent = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Replace block math $$...$$ with styled div
  let result = text.replace(/\$\$(.*?)\$\$/gs, (match, math) => {
    return `<div class="my-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-center font-mono text-sm text-purple-300 overflow-x-auto">${escapeHtml(math)}</div>`;
  });
  
  // Replace inline math $...$ with styled span (but not $$)
  result = result.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (match, math) => {
    return `<span class="font-mono bg-slate-800/50 border border-slate-700 px-1.5 py-0.5 rounded text-sm text-purple-300">${escapeHtml(math)}</span>`;
  });
  
  return result;
};

// Escape HTML to prevent XSS
const escapeHtml = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Component for rendering markdown with math support
export const MathText = ({ children, className = "" }) => {
  if (!children || typeof children !== 'string') {
    return <span className={className}>{children}</span>;
  }
  
  const hasMath = children.includes('$');
  
  if (hasMath) {
    return (
      <span 
        className={className}
        dangerouslySetInnerHTML={{ __html: renderMathContent(children) }} 
      />
    );
  }
  
  return <span className={className}>{children}</span>;
};

export default MathText;