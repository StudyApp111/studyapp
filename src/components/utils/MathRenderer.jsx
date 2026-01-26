import React from "react";

// Convert LaTeX to readable plain text
const latexToPlainText = (latex) => {
  let result = latex;
  
  // Handle \text{...} - extract text content
  result = result.replace(/\\text\{([^}]*)\}/g, '$1');
  
  // Handle \frac{a}{b} - convert to a/b
  result = result.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)');
  
  // Handle \left( and \right) - just use parentheses
  result = result.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  result = result.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
  
  // Handle common math operators
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\div/g, '÷');
  result = result.replace(/\\cdot/g, '·');
  result = result.replace(/\\pm/g, '±');
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\\neq/g, '≠');
  result = result.replace(/\\approx/g, '≈');
  result = result.replace(/\\infty/g, '∞');
  result = result.replace(/\\sqrt\{([^}]*)\}/g, '√($1)');
  result = result.replace(/\\sqrt/g, '√');
  
  // Handle Greek letters
  result = result.replace(/\\alpha/g, 'α');
  result = result.replace(/\\beta/g, 'β');
  result = result.replace(/\\gamma/g, 'γ');
  result = result.replace(/\\delta/g, 'δ');
  result = result.replace(/\\Delta/g, 'Δ');
  result = result.replace(/\\pi/g, 'π');
  result = result.replace(/\\sigma/g, 'σ');
  result = result.replace(/\\Sigma/g, 'Σ');
  result = result.replace(/\\mu/g, 'μ');
  result = result.replace(/\\lambda/g, 'λ');
  result = result.replace(/\\theta/g, 'θ');
  result = result.replace(/\\phi/g, 'φ');
  result = result.replace(/\\omega/g, 'ω');
  
  // Handle superscripts and subscripts (simplified)
  result = result.replace(/\^{([^}]*)}/g, '^($1)');
  result = result.replace(/_{([^}]*)}/g, '_($1)');
  result = result.replace(/\^(\d)/g, '^$1');
  result = result.replace(/_(\d)/g, '_$1');
  
  // Handle sum, product, integral
  result = result.replace(/\\sum/g, 'Σ');
  result = result.replace(/\\prod/g, 'Π');
  result = result.replace(/\\int/g, '∫');
  
  // Clean up remaining backslashes for common commands
  result = result.replace(/\\\s/g, ' ');
  result = result.replace(/\\,/g, ' ');
  result = result.replace(/\\;/g, ' ');
  result = result.replace(/\\!/g, '');
  result = result.replace(/\\quad/g, '  ');
  
  // Remove any remaining simple backslash commands
  result = result.replace(/\\([a-zA-Z]+)/g, '$1');
  
  return result.trim();
};

// LaTeX/Math rendering component for inline and block math
export const renderMathContent = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Replace block math $$...$$ with styled div
  let result = text.replace(/\$\$(.*?)\$\$/gs, (match, math) => {
    const plainMath = latexToPlainText(math);
    return `<div class="my-3 p-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono text-sm text-slate-800 dark:text-purple-300 overflow-x-auto">${escapeHtml(plainMath)}</div>`;
  });
  
  // Replace inline math $...$ with styled span (but not $$)
  result = result.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (match, math) => {
    const plainMath = latexToPlainText(math);
    return `<span class="font-mono bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-sm text-slate-800 dark:text-purple-300">${escapeHtml(plainMath)}</span>`;
  });
  
  // Also handle raw \text{} outside of $ delimiters (sometimes LLMs output this)
  result = result.replace(/\\text\{([^}]*)\}/g, '$1');
  
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