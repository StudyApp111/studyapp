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
  
  // === PHASE 1: Handle backslash LaTeX commands FIRST ===
  
  // Arrows with backslash
  result = result.replace(/\\rightarrow/g, '→');
  result = result.replace(/\\leftarrow/g, '←');
  result = result.replace(/\\to\b/g, '→');
  result = result.replace(/\\gets\b/g, '←');
  result = result.replace(/\\Rightarrow/g, '⇒');
  result = result.replace(/\\Leftarrow/g, '⇐');
  
  // Bar/overline with backslash (for nu-bar, etc)
  result = result.replace(/\\bar\{([^}]+)\}/g, '$1̄');
  result = result.replace(/\\overline\{([^}]+)\}/g, '$1̄');
  
  // Greek letters with backslash
  result = result.replace(/\\nu\b/g, 'ν');
  result = result.replace(/\\beta\b/g, 'β');
  result = result.replace(/\\alpha\b/g, 'α');
  result = result.replace(/\\gamma\b/g, 'γ');
  result = result.replace(/\\delta\b/g, 'δ');
  result = result.replace(/\\epsilon\b/g, 'ε');
  result = result.replace(/\\theta\b/g, 'θ');
  result = result.replace(/\\lambda\b/g, 'λ');
  result = result.replace(/\\mu\b/g, 'μ');
  result = result.replace(/\\pi\b/g, 'π');
  result = result.replace(/\\sigma\b/g, 'σ');
  result = result.replace(/\\phi\b/g, 'φ');
  result = result.replace(/\\omega\b/g, 'ω');
  result = result.replace(/\\rho\b/g, 'ρ');
  result = result.replace(/\\tau\b/g, 'τ');
  result = result.replace(/\\eta\b/g, 'η');
  result = result.replace(/\\psi\b/g, 'ψ');
  result = result.replace(/\\chi\b/g, 'χ');
  result = result.replace(/\\Delta\b/g, 'Δ');
  result = result.replace(/\\Sigma\b/g, 'Σ');
  result = result.replace(/\\Pi\b/g, 'Π');
  result = result.replace(/\\Omega\b/g, 'Ω');
  result = result.replace(/\\Gamma\b/g, 'Γ');
  result = result.replace(/\\Lambda\b/g, 'Λ');
  result = result.replace(/\\Phi\b/g, 'Φ');
  result = result.replace(/\\Psi\b/g, 'Ψ');
  
  // Times/multiplication with backslash
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\cdot/g, '·');
  result = result.replace(/\\div/g, '÷');
  result = result.replace(/\\pm/g, '±');
  result = result.replace(/\\mp/g, '∓');
  result = result.replace(/\\approx/g, '≈');
  result = result.replace(/\\neq/g, '≠');
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\\infty/g, '∞');
  result = result.replace(/\\partial/g, '∂');
  result = result.replace(/\\nabla/g, '∇');
  result = result.replace(/\\sum/g, '∑');
  result = result.replace(/\\prod/g, '∏');
  result = result.replace(/\\int/g, '∫');
  
  // Handle \frac{a}{b} and frac{a}{b} (sometimes backslash is missing)
  result = result.replace(/\\?frac\{([^}]+)\}\{([^}]+)\}/g, '<sup>$1</sup>⁄<sub>$2</sub>');
  
  // Handle rac{a}{b} - malformed frac without backslash (common AI output error)
  result = result.replace(/\brac\{([^}]+)\}\{([^}]+)\}/g, '<sup>$1</sup>⁄<sub>$2</sub>');
  
  // Handle \sqrt{x}
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√$1');
  
  // Handle \text{...} - important for units like J·s, m/s, kg
  result = result.replace(/\\text\{([^}]+)\}/g, '$1');
  result = result.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  result = result.replace(/\\textbf\{([^}]+)\}/g, '<b>$1</b>');
  
  // === PHASE 2: Handle non-backslash LaTeX (raw AI output) ===
  
  // Arrows without backslash
  result = result.replace(/\brightarrow\b/g, '→');
  result = result.replace(/\bleftarrow\b/g, '←');
  
  // Bar without backslash
  result = result.replace(/\bbar\{([^}]+)\}/g, '$1̄');
  
  // Times/cdot without backslash
  result = result.replace(/\btimes\b/g, '×');
  result = result.replace(/\bcdot\b/g, '·');
  
  // === PHASE 3: Handle subscripts and superscripts ===
  
  // Scientific notation: 6.626 × 10^{-34} or 6.626 x 10^-34
  result = result.replace(/(\d+(?:\.\d+)?)\s*[×x]\s*10\s*\^\s*\{?\s*(-?\d+)\s*\}?/gi, (match, num, exp) => {
    return `${num} × 10<sup>${exp}</sup>`;
  });
  
  // Handle isotope notation like ^{234}_{90}Th or 234/90 Th
  result = result.replace(/\^\{?(\d+)\}?\s*_\{?(\d+)\}?\s*([A-Z][a-z]?)/g, '<sup>$1</sup><sub>$2</sub>$3');
  result = result.replace(/(\d+)\/(\d+)\s*([A-Z][a-z]?)\b/g, '<sup>$1</sup><sub>$2</sub>$3');
  
  // Handle ^{exp} superscripts (with braces) - supports complex content
  result = result.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  
  // Handle ^exp superscripts (without braces, single char or signed number)
  result = result.replace(/\^(-?\d+)/g, '<sup>$1</sup>');
  
  // Handle _{sub} subscripts (with braces) - supports complex content
  result = result.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  
  // Handle _sub subscripts (without braces, for things like m_e, x_1)
  result = result.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
  
  // === PHASE 4: Clean up remaining backslash commands ===
  // Remove remaining backslashes from LaTeX commands we don't explicitly handle
  result = result.replace(/\\([a-zA-Z]+)/g, '$1');
  
  // === PHASE 5: Handle special notations ===
  
  // Handle square roots: sqrt(x)
  result = result.replace(/sqrt\(([^)]+)\)/gi, '√$1');
  
  // Handle cube roots
  result = result.replace(/cbrt\(([^)]+)\)/gi, '∛$1');
  
  // Handle simple fractions: (a/b)
  result = result.replace(/\((\d+)\/(\d+)\)/g, '<sup>$1</sup>⁄<sub>$2</sub>');
  
  // Greek letters (standalone words) - only if not already replaced
  const greekLetters = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 
    'epsilon': 'ε', 'theta': 'θ', 'lambda': 'λ', 'mu': 'μ',
    'pi': 'π', 'sigma': 'σ', 'phi': 'φ', 'omega': 'ω',
    'rho': 'ρ', 'tau': 'τ', 'eta': 'η', 'psi': 'ψ', 'chi': 'χ',
    'nu': 'ν',
    'Delta': 'Δ', 'Sigma': 'Σ', 'Pi': 'Π', 'Omega': 'Ω',
    'Gamma': 'Γ', 'Lambda': 'Λ', 'Phi': 'Φ', 'Psi': 'Ψ'
  };
  
  Object.entries(greekLetters).forEach(([name, symbol]) => {
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    result = result.replace(regex, symbol);
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