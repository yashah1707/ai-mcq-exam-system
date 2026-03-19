import React, { useEffect, useMemo, useRef, useState } from 'react';

const SYMBOL_CATEGORIES = [
  { id: 'basic-math', label: 'Basic Math', symbols: ['+', '−', '×', '÷', '=', '≠', '≈', '%', '±'] },
  { id: 'comparison', label: 'Comparison', symbols: ['<', '>', '≤', '≥'] },
  { id: 'advanced-math', label: 'Advanced Math', symbols: ['√', '∛', '∑', '∏', '∫', '∂', '∆', '∇', '∞', 'π', 'e'] },
  { id: 'fractions-powers', label: 'Powers', symbols: ['²', '³', 'ⁿ', '½', '¼', '¾'] },
  { id: 'logic', label: 'Logic', symbols: ['∧', '∨', '¬', '⇒', '⇔', '∴', '∵'] },
  { id: 'set-theory', label: 'Set Theory', symbols: ['∈', '∉', '⊂', '⊆', '⊃', '⊇', '∪', '∩', '∅'] },
  { id: 'arrows', label: 'Arrows', symbols: ['→', '←', '↑', '↓', '↔', '⇒', '⇐', '⇔'] },
  { id: 'greek', label: 'Greek', symbols: ['α', 'β', 'γ', 'θ', 'λ', 'μ', 'σ', 'Σ', 'Δ', 'Ω', 'π'] },
  { id: 'calculus', label: 'Calculus', symbols: ['∫', 'd/dx', 'dy/dx', '∂/∂x', 'lim', '→ ∞'] },
  { id: 'misc', label: 'Misc', symbols: ['|x|', '≡', '≅', '⌊x⌋', '⌈x⌉'] }
];

export default function SymbolPicker({ onInsert, inputRef, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(SYMBOL_CATEGORIES[0].id);
  const [placement, setPlacement] = useState('bottom');
  const containerRef = useRef(null);
  const popupRef = useRef(null);
  const triggerRef = useRef(null);

  const activeCategory = useMemo(
    () => SYMBOL_CATEGORIES.find((category) => category.id === activeCategoryId) || SYMBOL_CATEGORIES[0],
    [activeCategoryId]
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updatePlacement = () => {
      if (!triggerRef.current || !popupRef.current) {
        return;
      }

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const popupHeight = popupRef.current.offsetHeight || 320;
      const requiredSpace = Math.min(popupHeight + 12, 320);
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      if (spaceBelow < requiredSpace && spaceAbove > spaceBelow) {
        setPlacement('top');
        return;
      }

      setPlacement('bottom');
    };

    const rafId = window.requestAnimationFrame(updatePlacement);
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [isOpen, activeCategoryId]);

  const handleToggle = () => {
    if (disabled) {
      return;
    }

    setIsOpen((current) => !current);
  };

  const handleInsert = (symbol) => {
    onInsert(symbol);
    if (inputRef?.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`symbol-picker ${isOpen ? 'symbol-picker-open' : ''}`} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className="symbol-picker-trigger"
        aria-label="Open symbol keyboard"
        aria-expanded={isOpen}
        title="Insert symbol"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={handleToggle}
      >
        🔣
      </button>

      {isOpen && (
        <div
          ref={popupRef}
          className={`symbol-picker-popup ${placement === 'top' ? 'symbol-picker-popup-top' : 'symbol-picker-popup-bottom'}`}
          role="dialog"
          aria-label="Symbol keyboard"
        >
          <div className="symbol-picker-tabs" role="tablist" aria-label="Symbol categories">
            {SYMBOL_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                role="tab"
                className={`symbol-picker-tab ${category.id === activeCategory.id ? 'symbol-picker-tab-active' : ''}`}
                aria-selected={category.id === activeCategory.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="symbol-picker-panel">
            <div className="symbol-picker-heading">{activeCategory.label}</div>
            <div className="symbol-picker-grid">
              {activeCategory.symbols.map((symbol) => (
                <button
                  key={`${activeCategory.id}-${symbol}`}
                  type="button"
                  className="symbol-picker-symbol"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleInsert(symbol)}
                  title={`Insert ${symbol}`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}