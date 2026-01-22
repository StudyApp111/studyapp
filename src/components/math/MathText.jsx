import React from 'react';

// Comprehensive math/science text rendering
const renderMathText = (text) => {
  if (!text) return text;
  
  let result = String(text);
  
  // Step 1: Process content inside $...$ delimiters
  result = result.replace(/\$([^$]+)\$/g, (match, content) => renderLatexContent(content));
  
  // Step 2: Process content inside $$...$$ delimiters
  result = result.replace(/\$\$([^$]+)\$\$/g, (match, content) => 
    `<div style="text-align: center; margin: 0.5em 0;">${renderLatexContent(content)}</div>`
  );
  
  // Step 3: Process remaining text for non-delimited patterns
  result = renderLatexContent(result);
  
  return result;
};

// Convert LaTeX and raw notation to HTML
const renderLatexContent = (text) => {
  if (!text) return text;
  
  let result = text;
  
  // === ARROWS ===
  result = result.replace(/\\rightarrow/g, '→');
  result = result.replace(/\\leftarrow/g, '←');
  result = result.replace(/\\to\b/g, '→');
  result = result.replace(/\brightarrow\b/g, '→');
  result = result.replace(/\bleftarrow\b/g, '←');
  result = result.replace(/→/g, '→'); // Already correct
  
  // === MULTIPLICATION ===
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\cdot/g, '·');
  result = result.replace(/\bcdot\b/g, '·');
  result = result.replace(/\btimes\b/g, '×');
  
  // === GREEK LETTERS (with and without backslash) ===
  const greekMap = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε',
    'zeta': 'ζ', 'eta': 'η', 'theta': 'θ', 'iota': 'ι', 'kappa': 'κ',
    'lambda': 'λ', 'mu': 'μ', 'nu': 'ν', 'xi': 'ξ', 'pi': 'π',
    'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ', 'upsilon': 'υ', 'phi': 'φ',
    'chi': 'χ', 'psi': 'ψ', 'omega': 'ω',
    'Alpha': 'Α', 'Beta': 'Β', 'Gamma': 'Γ', 'Delta': 'Δ', 'Epsilon': 'Ε',
    'Zeta': 'Ζ', 'Eta': 'Η', 'Theta': 'Θ', 'Iota': 'Ι', 'Kappa': 'Κ',
    'Lambda': 'Λ', 'Mu': 'Μ', 'Nu': 'Ν', 'Xi': 'Ξ', 'Pi': 'Π',
    'Rho': 'Ρ', 'Sigma': 'Σ', 'Tau': 'Τ', 'Upsilon': 'Υ', 'Phi': 'Φ',
    'Chi': 'Χ', 'Psi': 'Ψ', 'Omega': 'Ω'
  };
  
  Object.entries(greekMap).forEach(([name, symbol]) => {
    result = result.replace(new RegExp(`\\\\${name}\\b`, 'g'), symbol);
    result = result.replace(new RegExp(`\\b${name}\\b`, 'g'), symbol);
  });
  
  // === OVERLINES / BARS (for antiparticles like ν̄) ===
  result = result.replace(/\\bar\{([^}]+)\}/g, '$1̄');
  result = result.replace(/\\overline\{([^}]+)\}/g, '$1̄');
  result = result.replace(/\bbar\{([^}]+)\}/g, '$1̄');
  result = result.replace(/ν̄/g, 'ν̄'); // Already correct
  
  // === SCIENTIFIC NOTATION: number × 10^exp ===
  // Handles: 6.626 × 10^-34, 6.626 x 10^{-34}, 6.626 \times 10^-34
  result = result.replace(/(\d+(?:\.\d+)?)\s*[×x]\s*10\s*\^\s*\{?\s*(-?\d+)\s*\}?/gi, (m, num, exp) => 
    `${num} × 10<sup>${exp}</sup>`
  );
  
  // === ISOTOPE NOTATION: ^A_Z X or ^{A}_{Z}X (like ^{234}_{90}Th) ===
  // Pattern: ^{mass}_{atomic}Element or ^mass_atomicElement
  result = result.replace(/\^\{?(\d+)\}?\s*_\{?(\d+)\}?\s*([A-Z][a-z]?)/g, '<sup>$1</sup><sub>$2</sub>$3');
  result = result.replace(/(\d+)\s*(\d+)\s*([A-Z][a-z]?)\b/g, (m, mass, atomic, elem) => {
    // Only if it looks like isotope notation (mass > atomic typically)
    if (parseInt(mass) > parseInt(atomic)) {
      return `<sup>${mass}</sup><sub>${atomic}</sub>${elem}`;
    }
    return m;
  });
  
  // === FRACTIONS ===
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<sup>$1</sup>⁄<sub>$2</sub>');
  
  // === SQUARE ROOT ===
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√$1');
  result = result.replace(/sqrt\(([^)]+)\)/gi, '√$1');
  
  // === SUPERSCRIPTS (exponents) ===
  // With braces: ^{-34} or ^{2+}
  result = result.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  // Without braces: ^-34 or ^2 (number with optional sign)
  result = result.replace(/\^(-?\d+)/g, '<sup>$1</sup>');
  
  // === SUBSCRIPTS ===
  // With braces: _{90}
  result = result.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  // Without braces: _2, _90
  result = result.replace(/_(\d+)/g, '<sub>$1</sub>');
  // Chemical subscripts: H_2O pattern (letter followed by underscore and number)
  result = result.replace(/([A-Za-z])_(\d+)/g, '$1<sub>$2</sub>');
  
  // === TEXT COMMAND ===
  result = result.replace(/\\text\{([^}]+)\}/g, '$1');
  
  // === SPECIAL SYMBOLS ===
  result = result.replace(/\\pm/g, '±');
  result = result.replace(/\\mp/g, '∓');
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\\neq/g, '≠');
  result = result.replace(/\\approx/g, '≈');
  result = result.replace(/\\infty/g, '∞');
  result = result.replace(/\\degree/g, '°');
  result = result.replace(/\+\/-/g, '±');
  result = result.replace(/<=/g, '≤');
  result = result.replace(/>=/g, '≥');
  result = result.replace(/!=/g, '≠');
  result = result.replace(/~=/g, '≈');
  result = result.replace(/infinity/gi, '∞');
  result = result.replace(/(\d+)\s*degrees?/gi, '$1°');
  
  // === CLEANUP: Remove remaining backslashes from unhandled LaTeX ===
  result = result.replace(/\\([a-zA-Z]+)/g, '$1');
  
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
  result = result.replace(/([a-zA-Z])(_)(\d+)/g, '$1<sub>$3</sub>');
  
  // Greek letters
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