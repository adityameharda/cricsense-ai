import React, { useState, useEffect, useRef } from 'react';

export const cleanCricketOvers = (str) => {
  if (typeof str === 'number') {
    const s = str.toFixed(1);
    if (s.endsWith('.6')) {
      return Math.floor(str) + 1;
    }
    return str;
  }
  if (!str || typeof str !== 'string') return str;
  return str.replace(/(\d+)\.6(?=[^\d]|$)/gi, (match, oversNum) => {
    return String(parseInt(oversNum, 10) + 1);
  });
};

/**
 * ScoreDisplay — Tabular score with micro-flash updates and clear typography
 */
export const ScoreDisplay = ({
  score = '—',
  highlight = false,
  size = 'md',
  className = '',
  style = {}
}) => {
  const [flash, setFlash] = useState(false);
  const prevScoreRef = useRef(score);

  const cleanScore = cleanCricketOvers(score);

  useEffect(() => {
    if (prevScoreRef.current !== score && prevScoreRef.current !== undefined && prevScoreRef.current !== '—') {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      prevScoreRef.current = score;
      return () => clearTimeout(t);
    }
    prevScoreRef.current = score;
  }, [score]);

  const sizeClasses = {
    xs: 'score-xs',
    sm: 'score-sm',
    md: 'score-md',
    lg: 'score-lg',
    xl: 'score-xl',
    hero: 'score-hero',
  };

  return (
    <span
      className={`cric-score-display ${sizeClasses[size] || 'score-md'} ${highlight ? 'is-highlight' : ''} ${flash ? 'is-flashing' : ''} ${className}`}
      style={style}
    >
      {cleanScore || '—'}
    </span>
  );
};

export default ScoreDisplay;
