import React from 'react';

// Comprehensive math/science LaTeX rendering utility
// Supports: Greek letters, fractions, subscripts, superscripts, isotopes, 
// chemical equations, physics notation, calculus symbols, matrices, vectors, and more

const renderMathText = (text) => {
  if (!text) return text;
  
  let result = String(text);
  
  // Handle display math: $$expression$$ (block level)
  result = result.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
    return `<div style="text-align: center; margin: 0.5em 0;">${renderLatexContent(content)}</div>`;
  });
  
  // Handle inline math: $expression$
  result = result.replace(/\$([^$]+)\$/g, (match, content) => {
    return renderLatexContent(content);
  });
  
  // Also process non-delimited content for basic math
  result = renderLatexContent(result);
  
  return result;
};

// Convert LaTeX-style notation to HTML
const renderLatexContent = (text) => {
  if (!text) return text;
  
  let result = text;
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 0: MATRICES AND ENVIRONMENTS (must come first!)
  // ═══════════════════════════════════════════════════════════════
  
  // Handle \begin{pmatrix}...\end{pmatrix} - parenthesized matrix
  result = result.replace(/\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g, (match, content) => {
    return renderMatrix(content, '(', ')');
  });
  
  // Handle \begin{bmatrix}...\end{bmatrix} - bracketed matrix
  result = result.replace(/\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g, (match, content) => {
    return renderMatrix(content, '[', ']');
  });
  
  // Handle \begin{vmatrix}...\end{vmatrix} - determinant matrix
  result = result.replace(/\\begin\{vmatrix\}([\s\S]*?)\\end\{vmatrix\}/g, (match, content) => {
    return renderMatrix(content, '|', '|');
  });
  
  // Handle \begin{matrix}...\end{matrix} - plain matrix (no brackets)
  result = result.replace(/\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/g, (match, content) => {
    return renderMatrix(content, '', '');
  });
  
  // Handle \begin{cases}...\end{cases} - piecewise functions
  result = result.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (match, content) => {
    const rows = content.split('\\\\').map(row => row.trim()).filter(row => row);
    const formattedRows = rows.map(row => {
      const parts = row.split('&').map(p => p.trim());
      return `<tr><td style="padding-right: 1em;">${renderLatexContent(parts[0] || '')}</td><td>${renderLatexContent(parts[1] || '')}</td></tr>`;
    }).join('');
    return `<span style="display: inline-flex; align-items: center;"><span style="font-size: 2em; margin-right: 0.2em;">{</span><table style="display: inline-table; vertical-align: middle; border-collapse: collapse; line-height: 1.4;">${formattedRows}</table></span>`;
  });
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: NUCLEAR/ISOTOPE NOTATION (must come early!)
  // ═══════════════════════════════════════════════════════════════
  
  // Handle malformed isotope notation like {}92238U or {}_92^238U
  result = result.replace(/\{\}\s*(\d{1,3})(\d{2,3})([A-Z][a-z]?)/g, (match, p1, p2, elem) => {
    const combined = p1 + p2;
    if (combined.length >= 4) {
      const atomicNum = combined.slice(0, 2);
      const massNum = combined.slice(2);
      return `<sup>${massNum}</sup><sub>${atomicNum}</sub>${elem}`;
    }
    return `<sup>${p2}</sup><sub>${p1}</sub>${elem}`;
  });
  
  // Handle {}24α pattern (helium-4 alpha particle)
  result = result.replace(/\{\}\s*(\d)(\d)([αβγ]|alpha|beta|gamma)/gi, (match, p1, p2, particle) => {
    const particleMap = { 'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'α': 'α', 'β': 'β', 'γ': 'γ' };
    return `<sup>${p2}</sup><sub>${p1}</sub>${particleMap[particle.toLowerCase()] || particle}`;
  });
  
  // Standard isotope: ^{mass}_{atomic}Element or ^mass_atomicElement
  result = result.replace(/\^\{?(\d+)\}?\s*_\{?(\d+)\}?\s*([A-Z][a-z]{0,2})/g, '<sup>$1</sup><sub>$2</sub>$3');
  result = result.replace(/_\{?(\d+)\}?\s*\^\{?(\d+)\}?\s*([A-Z][a-z]{0,2})/g, '<sup>$2</sup><sub>$1</sub>$3');
  
  // Isotope with just mass: ^{238}U or ^238U
  result = result.replace(/\^\{?(\d+)\}?\s*([A-Z][a-z]{0,2})(?![a-z])/g, '<sup>$1</sup>$2');
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: FRACTIONS (before other processing)
  // ═══════════════════════════════════════════════════════════════
  
  // \frac{a}{b}, frac{a}{b}, rac{a}{b} (common AI errors)
  result = result.replace(/\\?f?rac\{([^}]+)\}\{([^}]+)\}/g, '<sup>$1</sup>⁄<sub>$2</sub>');
  
  // \dfrac and \tfrac variants
  result = result.replace(/\\[dt]frac\{([^}]+)\}\{([^}]+)\}/g, '<sup>$1</sup>⁄<sub>$2</sub>');
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: GREEK LETTERS (with backslash)
  // ═══════════════════════════════════════════════════════════════
  
  const greekWithBackslash = {
    // Lowercase
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε',
    'varepsilon': 'ε', 'zeta': 'ζ', 'eta': 'η', 'theta': 'θ', 'vartheta': 'ϑ',
    'iota': 'ι', 'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ', 'nu': 'ν',
    'xi': 'ξ', 'omicron': 'ο', 'pi': 'π', 'varpi': 'ϖ', 'rho': 'ρ',
    'varrho': 'ϱ', 'sigma': 'σ', 'varsigma': 'ς', 'tau': 'τ', 'upsilon': 'υ',
    'phi': 'φ', 'varphi': 'ϕ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω',
    // Uppercase
    'Alpha': 'Α', 'Beta': 'Β', 'Gamma': 'Γ', 'Delta': 'Δ', 'Epsilon': 'Ε',
    'Zeta': 'Ζ', 'Eta': 'Η', 'Theta': 'Θ', 'Iota': 'Ι', 'Kappa': 'Κ',
    'Lambda': 'Λ', 'Mu': 'Μ', 'Nu': 'Ν', 'Xi': 'Ξ', 'Omicron': 'Ο',
    'Pi': 'Π', 'Rho': 'Ρ', 'Sigma': 'Σ', 'Tau': 'Τ', 'Upsilon': 'Υ',
    'Phi': 'Φ', 'Chi': 'Χ', 'Psi': 'Ψ', 'Omega': 'Ω'
  };
  
  Object.entries(greekWithBackslash).forEach(([name, symbol]) => {
    result = result.replace(new RegExp(`\\\\${name}\\b`, 'g'), symbol);
  });
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: MATH OPERATORS & SYMBOLS (with backslash)
  // ═══════════════════════════════════════════════════════════════
  
  const mathSymbols = {
    // Arrows
    'rightarrow': '→', 'leftarrow': '←', 'leftrightarrow': '↔',
    'Rightarrow': '⇒', 'Leftarrow': '⇐', 'Leftrightarrow': '⇔',
    'uparrow': '↑', 'downarrow': '↓', 'updownarrow': '↕',
    'longrightarrow': '⟶', 'longleftarrow': '⟵',
    'to': '→', 'gets': '←', 'mapsto': '↦',
    
    // Binary operators
    'times': '×', 'cdot': '·', 'div': '÷', 'ast': '∗',
    'star': '⋆', 'circ': '∘', 'bullet': '•',
    'pm': '±', 'mp': '∓', 'oplus': '⊕', 'ominus': '⊖',
    'otimes': '⊗', 'oslash': '⊘', 'odot': '⊙',
    
    // Relations
    'leq': '≤', 'geq': '≥', 'neq': '≠', 'approx': '≈',
    'equiv': '≡', 'sim': '∼', 'simeq': '≃', 'cong': '≅',
    'propto': '∝', 'll': '≪', 'gg': '≫',
    'subset': '⊂', 'supset': '⊃', 'subseteq': '⊆', 'supseteq': '⊇',
    'in': '∈', 'notin': '∉', 'ni': '∋',
    'perp': '⊥', 'parallel': '∥', 'angle': '∠',
    
    // Calculus & Analysis
    'partial': '∂', 'nabla': '∇', 'infty': '∞',
    'int': '∫', 'iint': '∬', 'iiint': '∭', 'oint': '∮',
    'sum': '∑', 'prod': '∏', 'coprod': '∐',
    'lim': 'lim', 'limsup': 'lim sup', 'liminf': 'lim inf',
    
    // Logic
    'forall': '∀', 'exists': '∃', 'nexists': '∄',
    'land': '∧', 'lor': '∨', 'lnot': '¬', 'neg': '¬',
    'implies': '⟹', 'iff': '⟺',
    
    // Sets
    'emptyset': '∅', 'varnothing': '∅',
    'cup': '∪', 'cap': '∩', 'setminus': '∖',
    
    // Misc symbols
    'degree': '°', 'degrees': '°', 'prime': '′', 'dprime': '″',
    'hbar': 'ℏ', 'ell': 'ℓ', 'Re': 'ℜ', 'Im': 'ℑ',
    'aleph': 'ℵ', 'wp': '℘',
    'triangle': '△', 'square': '□', 'diamond': '◇',
    'therefore': '∴', 'because': '∵',
    
    // Chemistry/Physics specific  
    'ce': '', // Remove \ce wrapper
    'pu': '', // Remove \pu wrapper
  };
  
  Object.entries(mathSymbols).forEach(([cmd, symbol]) => {
    result = result.replace(new RegExp(`\\\\${cmd}\\b`, 'g'), symbol);
  });
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: TEXT FORMATTING COMMANDS
  // ═══════════════════════════════════════════════════════════════
  
  // \text{...}, \mathrm{...}, \textrm{...}, \mbox{...}
  result = result.replace(/\\(?:text|mathrm|textrm|mbox)\{([^}]+)\}/g, '$1');
  result = result.replace(/\\textbf\{([^}]+)\}/g, '<b>$1</b>');
  result = result.replace(/\\textit\{([^}]+)\}/g, '<i>$1</i>');
  result = result.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');
  result = result.replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>');
  result = result.replace(/\\mathit\{([^}]+)\}/g, '<i>$1</i>');
  result = result.replace(/\\boldsymbol\{([^}]+)\}/g, '<b>$1</b>');
  
  // Accents and decorations
  result = result.replace(/\\bar\{([^}]+)\}/g, '$1̄');
  result = result.replace(/\\overline\{([^}]+)\}/g, '$1̄');
  result = result.replace(/\\vec\{([^}]+)\}/g, '$1⃗');
  result = result.replace(/\\hat\{([^}]+)\}/g, '$1̂');
  result = result.replace(/\\tilde\{([^}]+)\}/g, '$1̃');
  result = result.replace(/\\dot\{([^}]+)\}/g, '$1̇');
  result = result.replace(/\\ddot\{([^}]+)\}/g, '$1̈');
  
  // Roots
  result = result.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '<sup>$1</sup>√$2');
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√$1');
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 6: BRACKETS & DELIMITERS
  // ═══════════════════════════════════════════════════════════════
  
  result = result.replace(/\\left\(/g, '(');
  result = result.replace(/\\right\)/g, ')');
  result = result.replace(/\\left\[/g, '[');
  result = result.replace(/\\right\]/g, ']');
  result = result.replace(/\\left\{/g, '{');
  result = result.replace(/\\right\}/g, '}');
  result = result.replace(/\\left\|/g, '|');
  result = result.replace(/\\right\|/g, '|');
  result = result.replace(/\\langle/g, '⟨');
  result = result.replace(/\\rangle/g, '⟩');
  result = result.replace(/\\lceil/g, '⌈');
  result = result.replace(/\\rceil/g, '⌉');
  result = result.replace(/\\lfloor/g, '⌊');
  result = result.replace(/\\rfloor/g, '⌋');
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 7: SCIENTIFIC NOTATION & UNITS
  // ═══════════════════════════════════════════════════════════════
  
  // Scientific notation: 6.626 × 10^{-34} or 6.626 x 10^-34
  result = result.replace(/(\d+(?:\.\d+)?)\s*[×x]\s*10\s*\^\s*\{?\s*(-?\d+)\s*\}?/gi, '$1 × 10<sup>$2</sup>');
  
  // Handle 10^n patterns
  result = result.replace(/10\s*\^\s*\{?\s*(-?\d+)\s*\}?/g, '10<sup>$1</sup>');
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 8: SUBSCRIPTS & SUPERSCRIPTS (general)
  // ═══════════════════════════════════════════════════════════════
  
  // Handle ^{exp} superscripts (with braces)
  result = result.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  
  // Handle ^exp superscripts (single char or signed number)
  result = result.replace(/\^(-?\d+)/g, '<sup>$1</sup>');
  result = result.replace(/\^([+\-])/g, '<sup>$1</sup>');
  result = result.replace(/\^([a-zA-Z])/g, '<sup>$1</sup>');
  
  // Handle _{sub} subscripts (with braces)
  result = result.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  
  // Handle _sub subscripts (single char)
  result = result.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 9: CHEMISTRY NOTATION
  // ═══════════════════════════════════════════════════════════════
  
  // Chemical arrows
  result = result.replace(/-->/g, '→');
  result = result.replace(/<--/g, '←');
  result = result.replace(/<-->/g, '⇌');
  result = result.replace(/<=>/g, '⇌');
  result = result.replace(/->>/g, '⇀');
  result = result.replace(/<<-/g, '↼');
  
  // Charge notation: ^+ or ^- or ^{2+}
  result = result.replace(/\^\{(\d*[+\-])\}/g, '<sup>$1</sup>');
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 10: PLAIN TEXT GREEK (standalone words)
  // ═══════════════════════════════════════════════════════════════
  
  const plainGreek = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε',
    'zeta': 'ζ', 'eta': 'η', 'theta': 'θ', 'iota': 'ι', 'kappa': 'κ',
    'lambda': 'λ', 'mu': 'μ', 'nu': 'ν', 'xi': 'ξ', 'pi': 'π',
    'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ', 'upsilon': 'υ', 'phi': 'φ',
    'chi': 'χ', 'psi': 'ψ', 'omega': 'ω',
    'Delta': 'Δ', 'Gamma': 'Γ', 'Lambda': 'Λ', 'Phi': 'Φ', 'Pi': 'Π',
    'Psi': 'Ψ', 'Sigma': 'Σ', 'Theta': 'Θ', 'Omega': 'Ω', 'Xi': 'Ξ'
  };
  
  Object.entries(plainGreek).forEach(([name, symbol]) => {
    result = result.replace(new RegExp(`\\b${name}\\b`, 'g'), symbol);
  });
  
  // ═══════════════════════════════════════════════════════════════
  // PHASE 11: PLAIN TEXT OPERATORS & CLEANUP
  // ═══════════════════════════════════════════════════════════════
  
  // Common text equivalents
  result = result.replace(/\+\/-/g, '±');
  result = result.replace(/<=/g, '≤');
  result = result.replace(/>=/g, '≥');
  result = result.replace(/!=/g, '≠');
  result = result.replace(/~=/g, '≈');
  result = result.replace(/\binfinity\b/gi, '∞');
  result = result.replace(/(\d+)\s*degrees?\b/gi, '$1°');
  result = result.replace(/\bdegC\b/g, '°C');
  result = result.replace(/\bdegF\b/g, '°F');
  
  // Plain text math words
  result = result.replace(/\brightarrow\b/g, '→');
  result = result.replace(/\bleftarrow\b/g, '←');
  result = result.replace(/\btimes\b/g, '×');
  result = result.replace(/\bcdot\b/g, '·');
  
  // Clean up empty braces and remaining backslashes
  result = result.replace(/\{\}/g, '');
  result = result.replace(/\\([a-zA-Z]+)/g, '$1'); // Remove unhandled backslash commands
  
  // Clean up double spaces
  result = result.replace(/\s+/g, ' ');
  
  return result;
};

// Helper function to render matrix content
const renderMatrix = (content, leftBracket, rightBracket) => {
  // Split by \\ for rows
  const rows = content.split('\\\\').map(row => row.trim()).filter(row => row);
  
  if (rows.length === 0) return '';
  
  // Build vertical matrix display
  const formattedRows = rows.map(row => {
    // Split by & for columns (if any), otherwise treat as single column
    const cells = row.includes('&') ? row.split('&') : [row];
    const formattedCells = cells.map(cell => 
      `<td style="padding: 0.15em 0.3em; text-align: center;">${renderLatexContent(cell.trim())}</td>`
    ).join('');
    return `<tr>${formattedCells}</tr>`;
  }).join('');
  
  const bracketStyle = 'font-size: 1.5em; line-height: 1; vertical-align: middle;';
  const leftBracketHtml = leftBracket ? `<span style="${bracketStyle}">${leftBracket}</span>` : '';
  const rightBracketHtml = rightBracket ? `<span style="${bracketStyle}">${rightBracket}</span>` : '';
  
  return `<span style="display: inline-flex; align-items: center; vertical-align: middle;">${leftBracketHtml}<table style="display: inline-table; vertical-align: middle; border-collapse: collapse; line-height: 1.2;">${formattedRows}</table>${rightBracketHtml}</span>`;
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