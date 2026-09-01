import React from 'react';

/**
 * OverStrip — Ball-by-ball delivery strip
 * W = red out, 6 = fiery amber, 4 = electric blue, • = dot, runs = neutral, nb/wd = penalty
 */
export const OverStrip = ({ balls = [], label = 'This Over', className = '' }) => {
  if (!balls || balls.length === 0) return null;

  const getChipClass = (ball) => {
    const b = String(ball).toUpperCase().trim();
    if (b === 'W' || b.startsWith('W') || b === 'OUT') return 'ball-chip-wicket';
    if (b === '6') return 'ball-chip-six';
    if (b === '4') return 'ball-chip-four';
    if (b === '0' || b === '•' || b === '.' || b === '-') return 'ball-chip-dot';
    if (b.includes('WD') || b.includes('NB') || b.includes('LB') || b.includes('B')) return 'ball-chip-extra';
    return 'ball-chip-run';
  };

  return (
    <div className={`over-strip-container ${className}`}>
      {label && <span className="over-strip-label">{label}:</span>}
      <div className="over-strip-balls">
        {balls.map((ball, i) => {
          const displayChar =
            ball === '0' || ball === '.' || ball === '-' ? '•' : ball;
          const chipClass = getChipClass(ball);
          return (
            <div
              key={i}
              className={`ball-chip ${chipClass}`}
              title={`Ball ${i + 1}: ${ball}`}
            >
              {displayChar}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OverStrip;
