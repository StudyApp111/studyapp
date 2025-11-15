import React from 'react';

// Comprehensive math rendering utility
const renderMathText = (text) => {
  if (!text) return text;
  
  let result = text;
  
  // Handle square roots: sqrt(x) or √(x)
  result = result.replace(/sqrt\(([^)]+)\)/gi, '√($1)');
  result = result.replace(/√\(([^)]+)\)/g, '√<span style="text-decoration: overline;">$1</span>');
  
  // Handle cube roots
  result = result.replace(/cbrt\(([^)]+)\)/gi, '∛($1)');
  result = result.replace(/∛\(([^)]+)\)/g, '∛<span style="text-decoration: overline;">$1</span>');
  
  // Handle fractions: (a/b) where context makes it clear
  result = result.replace(/\((\d+)\/(\d+)\)/g, '<sup>$1</sup>/<sub>$2</sub>');
  
  // Handle superscripts (exponents): x^2, x^10, x^-3, etc.
  // More comprehensive pattern to catch negative exponents and multi-digit exponents
  result = result.replace(/([a-zA-Z0-9\)])(\^)(-?\d+)/g, (match, base, caret, exp) => {
    return `${base}<sup>${exp}</sup>`;
  });
  
  // Handle grouped superscripts: (expression)^n
  result = result.replace(/\(([^)]+)\)\^(-?\d+)/g, '($1)<sup>$2</sup>');
  
  // Handle subscripts: H_2O, x_1, etc.
  result = result.replace(/([a-zA-Z])(_)(\d+)/g, '$1<sub>$3</sub>');
  
  // Greek letters (common ones)
  const greekLetters = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 
    'epsilon': 'ε', 'theta': 'θ', 'lambda': 'λ', 'mu': 'μ',
    'pi': 'π', 'sigma': 'σ', 'phi': 'φ', 'omega': 'ω',
    'Delta': 'Δ', 'Sigma': 'Σ', 'Pi': 'Π', 'Omega': 'Ω'
  };
  
  Object.entries(greekLetters).forEach(([name, symbol]) => {
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    result = result.replace(regex, symbol);
  });
  
  // Math operators and symbols
  result = result.replace(/\+\/-/g, '±');
  result = result.replace(/<=/g, '≤');
  result = result.replace(/>=/g, '≥');
  result = result.replace(/!=/g, '≠');
  result = result.replace(/~=/g, '≈');
  result = result.replace(/\*\*/g, '·'); // multiplication dot
  result = result.replace(/infinity/gi, '∞');
  
  // Degrees symbol
  result = result.replace(/(\d+)\s*degrees?/gi, '$1°');
  
  return result;
};

// Component for rendering mathematical text
export default function MathText({ children, className = "", inline = false }) {
  const Tag = inline ? 'span' : 'div';
  const htmlContent = renderMathText(String(children || ''));
  
  return (
    <Tag 
      className={className}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{
        fontFamily: 'inherit',
        lineHeight: inline ? 'inherit' : '1.6'
      }}
    />
  );
}

// Export the utility function for use elsewhere
export { renderMathText };