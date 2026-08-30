import React from 'react';

/**
 * OverStrip — ball-by-ball over visualization (light theme)
 * W = red, 6 = amber, 4 = blue, • = muted, runs = neutral
 */
export const OverStrip = ({ balls = [], label = 'This Over' }) => {
  if (!balls || balls.length === 0) return null;

  const getChipClass = (ball) => {
    const b = String(ball).toUpperCase().trim();
    if (b === 'W' || b.startsWith('W')) return 'wicket';
    if (b === '6') return 'six';
    if (b === '4') return 'four';
    if (b === '0' || b === '•' || b === '.' || b === '-') return 'dot';
    return 'run';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {label && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            marginRight: 4,
          }}
        >
          {label}:
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {balls.map((ball, i) => {
          const displayChar =
            ball === '0' || ball === '.' || ball === '-' ? '•' : ball;
          return (
            <div
              key={i}
              className={`ball-chip ${getChipClass(ball)}`}
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
