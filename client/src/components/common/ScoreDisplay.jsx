import React, { useState, useEffect, useRef } from 'react';

/**
 * ScoreDisplay — light theme tabular score with flash animation on update
 */
export const ScoreDisplay = ({
  score = '—',
  highlight = false,
  size = 'md',
  className = '',
}) => {
  const [flash, setFlash] = useState(false);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (prevScoreRef.current !== score && prevScoreRef.current !== undefined) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevScoreRef.current = score;
      return () => clearTimeout(t);
    }
    prevScoreRef.current = score;
  }, [score]);

  const sizeStyles = {
    sm: { fontSize: 13, fontWeight: 600 },
    md: { fontSize: 15, fontWeight: 700 },
    lg: { fontSize: 18, fontWeight: 800 },
    xl: { fontSize: 24, fontWeight: 900 },
  };

  const style = {
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
    padding: '2px 4px',
    borderRadius: 4,
    transition: 'background-color 0.3s, color 0.3s',
    ...(sizeStyles[size] || sizeStyles.md),
    ...(flash
      ? { backgroundColor: '#bbf7d0', color: '#065f46' }
      : highlight
      ? { color: 'var(--color-primary)' }
      : { color: 'var(--text-primary)' }),
  };

  return (
    <span style={style} className={className}>
      {score || '—'}
    </span>
  );
};

export default ScoreDisplay;
