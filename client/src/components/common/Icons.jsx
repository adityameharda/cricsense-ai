import React from 'react';

// Reusable vector SVG Icon library with consistent stroke-width (1.75) and rich cricket & UI semantics
export const Icon = ({ name, className = '', size = 16, color = 'currentColor', style = {}, ...props }) => {
  const iconProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style },
    className,
    ...props
  };

  switch (String(name).toLowerCase()) {
    // ── Cricket & Sports ──
    case 'cricket':
    case 'bat':
      return (
        <svg {...iconProps}>
          <path d="m14 14 7-7a2 2 0 0 0-2.83-2.83l-7 7" />
          <path d="m9 19 2-2" />
          <path d="m3 21 3-3" />
          <circle cx="18" cy="18" r="3" fill="currentColor" fillOpacity="0.15" />
        </svg>
      );
    case 'ball':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M5.636 5.636a9 9 0 0 1 12.728 12.728" />
          <path d="M18.364 5.636a9 9 0 0 0-12.728 12.728" strokeDasharray="2 2" />
        </svg>
      );
    case 'wicket':
    case 'stumps':
      return (
        <svg {...iconProps}>
          <line x1="6" y1="4" x2="6" y2="20" strokeWidth="2.2" />
          <line x1="12" y1="4" x2="12" y2="20" strokeWidth="2.2" />
          <line x1="18" y1="4" x2="18" y2="20" strokeWidth="2.2" />
          <line x1="4" y1="4" x2="20" y2="4" strokeWidth="2.5" />
          <line x1="3" y1="20" x2="21" y2="20" strokeWidth="2.5" />
        </svg>
      );
    case 'trophy':
    case 'cup':
      return (
        <svg {...iconProps}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="currentColor" fillOpacity="0.12" />
        </svg>
      );
    case 'award':
    case 'medal':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      );
    case 'crown':
      return (
        <svg {...iconProps}>
          <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z" />
        </svg>
      );
    case 'flame':
    case 'fire':
    case 'hot':
      return (
        <svg {...iconProps}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case 'zap':
    case 'live':
    case 'bolt':
      return (
        <svg {...iconProps}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.15" />
        </svg>
      );
    case 'radio':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
        </svg>
      );

    // ── AI & CricSense ──
    case 'sparkles':
    case 'ai':
    case 'cricsense':
      return (
        <svg {...iconProps}>
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" fill="currentColor" fillOpacity="0.15" />
          <path d="M5 3v4" />
          <path d="M19 17v4" />
          <path d="M3 5h4" />
          <path d="M17 19h4" />
        </svg>
      );

    // ── Navigation & Meta ──
    case 'mappin':
    case 'venue':
    case 'location':
      return (
        <svg {...iconProps}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    case 'calendar':
    case 'date':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      );
    case 'clock':
    case 'time':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'users':
    case 'squads':
    case 'team':
      return (
        <svg {...iconProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'user':
    case 'player':
      return (
        <svg {...iconProps}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'activity':
    case 'stats':
    case 'chart':
    case 'analytics':
      return (
        <svg {...iconProps}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case 'target':
    case 'aim':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      );
    case 'shield':
    case 'defense':
      return (
        <svg {...iconProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        </svg>
      );
    case 'coins':
    case 'coin':
    case 'points':
      return (
        <svg {...iconProps}>
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h2v4H7z" fill="currentColor" fillOpacity="0.2" />
          <path d="m14 12 2-2" />
        </svg>
      );
    case 'trend-up':
      return (
        <svg {...iconProps}>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case 'trend-down':
      return (
        <svg {...iconProps}>
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...iconProps}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      );
    case 'copy':
    case 'clipboard':
      return (
        <svg {...iconProps}>
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...iconProps}>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'unlock':
      return (
        <svg {...iconProps}>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      );
    case 'mail':
    case 'email':
      return (
        <svg {...iconProps}>
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...iconProps}>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    case 'eye-off':
      return (
        <svg {...iconProps}>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
      );
    case 'check':
      return (
        <svg {...iconProps}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...iconProps}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'refresh':
    case 'sync':
      return (
        <svg {...iconProps}>
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      );
    case 'chevron-right':
    case 'arrow-right':
      return (
        <svg {...iconProps}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    case 'chevron-left':
    case 'arrow-left':
    case 'back':
      return (
        <svg {...iconProps}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      );
    case 'chevron-down':
    case 'arrow-down':
    case 'down':
      return (
        <svg {...iconProps}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case 'chevron-up':
    case 'arrow-up':
    case 'up':
      return (
        <svg {...iconProps}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      );
    case 'x':
    case 'close':
      return (
        <svg {...iconProps}>
          <line x1="18" x2="6" y1="6" y2="18" />
          <line x1="6" x2="18" y1="6" y2="18" />
        </svg>
      );
    case 'log-out':
    case 'logout':
      return (
        <svg {...iconProps}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
      );
    case 'log-in':
    case 'login':
      return (
        <svg {...iconProps}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" x2="3" y1="12" y2="12" />
        </svg>
      );
    case 'info':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="16" y2="12" />
          <line x1="12" x2="12.01" y1="8" y2="8" strokeWidth="2.5" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...iconProps}>
          <line x1="12" x2="12" y1="5" y2="19" />
          <line x1="5" x2="19" y1="12" y2="12" />
        </svg>
      );
    case 'minus':
      return (
        <svg {...iconProps}>
          <line x1="5" x2="19" y1="12" y2="12" />
        </svg>
      );
    case 'play':
    case 'tv':
      return (
        <svg {...iconProps}>
          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    case 'speed':
    case 'gauge':
      return (
        <svg {...iconProps}>
          <path d="m12 14 4-4" />
          <path d="M3.34 19a10 10 0 1 1 17.32 0" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
};

export default Icon;
