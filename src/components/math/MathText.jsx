import React from 'react';

// Comprehensive math rendering utility
const renderMathText = (text) => {
  if (!text) return text;
  
  let result = String(text);
  
  // Remove LaTeX delimiters ($...$) and render the content
  // Handle inline math: $expression$
  result = result.replace(/\$([^$]+)\$/g, (match, content) => {
    return renderLatexContent(content);
  });
  
  // Handle display math: $$expression$$
  result = result.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
    return `<div style="text-align: center; margin: 0.5em 0;">${renderLatexContent(content)}</div>`;
  });
  
  // Also process non-delimited content for basic math
  result = renderLatexContent(result);
  
  return result;
};

// Convert LaTeX-style notation to HTML
const renderLatexContent = (text) => {
  if (!text) return text;
  
  let result = text;
  
  // Handle common LaTeX commands (with or without backslash)
  result = result.replace(/\\?rightarrow/g, '→');
  result = result.replace(/\\?leftarrow/g, '←');
  result = result.replace(/\\?leftrightarrow/g, '↔');
  result = result.replace(/\\?bar\{([^}]+)\}/g, '$1̄'); // combining overline
  result = result.replace(/\\?bar\{?(\w+)\}?/g, '$1̄');
  result = result.replace(/\\?nu\b/g, 'ν');
  result = result.replace(/\\times/g, '×');
  
  // Handle isotope notation: A/Z X or ^A_Z X (e.g., 32/15 P → ³²₁₅P)
  result = result.replace(/(\d+)\/(\d+)\s*([A-Za-z]+)/g, (match, mass, atomic, symbol) => {
    return `<sup>${mass}</sup><sub>${atomic}</sub>${symbol}`;
  });
  
  // Handle nuclear notation: ^{A}_{Z}X or ^A_ZX
  result = result.replace(/\^?\{?(\d+)\}?_?\{?(\d+)\}?\s*([A-Za-z]{1,2})\b/g, (match, mass, atomic, symbol) => {
    return `<sup>${mass}</sup><sub>${atomic}</sub>${symbol}`;
  });
  
  // Handle scientific notation: number \times 10^{exp} or number × 10^exp
  result = result.replace(/(\d+(?:\.\d+)?)\s*[×x]\s*10\^?\{?(-?\d+)\}?/gi, (match, num, exp) => {
    return `${num} × 10<sup>${exp}</sup>`;
  });
  
  // Handle \frac{a}{b}
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<sup>$1</sup>⁄<sub>$2</sub>');
  
  // Handle \sqrt{x}
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√$1');
  
  // Handle ^{exp} superscripts (with braces)
  result = result.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  
  // Handle ^exp superscripts (without braces, single char or number)
  result = result.replace(/\^(-?\d+)/g, '<sup>$1</sup>');
  
  // Handle _{sub} subscripts (with braces)
  result = result.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  
  // Handle _sub subscripts (without braces, numbers)
  result = result.replace(/_(-?\d+)/g, '<sub>$1</sub>');
  
  // Handle \text{...}
  result = result.replace(/\\text\{([^}]+)\}/g, '$1');
  
  // Handle square roots: sqrt(x) or √(x)
  result = result.replace(/sqrt\(([^)]+)\)/gi, '√$1');
  
  // Handle cube roots
  result = result.replace(/cbrt\(([^)]+)\)/gi, '∛$1');
  
  // Handle fractions: (a/b) where context makes it clear
  result = result.replace(/\((\d+)\/(\d+)\)/g, '<sup>$1</sup>⁄<sub>$2</sub>');
  
  // Handle remaining superscripts: x^2, x^10, x^-3
  result = result.replace(/([a-zA-Z0-9\)])(\^)(-?\d+)/g, '$1<sup>$3</sup>');
  
  // Handle grouped superscripts: (expression)^n
  result = result.replace(/\(([^)]+)\)\^(-?\d+)/g, '($1)<sup>$2</sup>');
  
  // Handle subscripts: H_2O, x_1
  result = result.replace(/([a-zA-Z])_(\d+)/g, '$1<sub>$2</sub>');
  
  // Greek letters (handle both with and without backslash)
  const greekLetters = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 
    'epsilon': 'ε', 'theta': 'θ', 'lambda': 'λ', 'mu': 'μ',
    'pi': 'π', 'sigma': 'σ', 'phi': 'φ', 'omega': 'ω',
    'Delta': 'Δ', 'Sigma': 'Σ', 'Pi': 'Π', 'Omega': 'Ω'
  };
  
  Object.entries(greekLetters).forEach(([name, symbol]) => {
    result = result.replace(new RegExp(`\\\\${name}\\b`, 'g'), symbol);
    result = result.replace(new RegExp(`\\b${name}\\b`, 'g'), symbol);
  });
  
  // Math operators
  result = result.replace(/\+\/-/g, '±');
  result = result.replace(/<=/g, '≤');
  result = result.replace(/>=/g, '≥');
  result = result.replace(/!=/g, '≠');
  result = result.replace(/~=/g, '≈');
  result = result.replace(/infinity/gi, '∞');
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