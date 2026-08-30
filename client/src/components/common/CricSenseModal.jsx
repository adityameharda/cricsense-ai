import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icons';

/**
 * CricSense AI Assistant — Light Theme
 */
export const CricSenseModal = ({ isOpen, onClose, activeMatch }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: activeMatch
        ? `I'm analyzing ${activeMatch.teamA} vs ${activeMatch.teamB}. Ask me for live tactical breakdowns, win probability, or fantasy picks!`
        : 'Welcome to CricSense AI! Select any live match to get deep tactical insights, win probability, and fantasy recommendations.',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const threadRef = useRef(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSend = (textToSend) => {
    const q = (textToSend || query).trim();
    if (!q) return;

    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setQuery('');
    setIsTyping(true);

    setTimeout(() => {
      const lower = q.toLowerCase();
      let reply;

      const teamA = activeMatch?.teamA || 'Team A';
      const teamB = activeMatch?.teamB || 'Team B';
      const scoreA = activeMatch?.scoreA || '0/0';
      const scoreB = activeMatch?.scoreB || '0/0';
      const striker = activeMatch?.striker || 'Top-order anchor';
      const bowler = activeMatch?.bowler || 'Frontline pacer';

      if (lower.includes('win') || lower.includes('probability') || lower.includes('who will win') || lower.includes('predict')) {
        reply = `📊 Win Probability Analysis:\n• ${teamA}: 58.2% win index (${scoreA})\n• ${teamB}: 41.8% win index (${scoreB})\n\n💡 Key Factor: Required run rate and current boundary percentage in the middle overs favor ${teamA}.`;
      } else if (lower.includes('fantasy') || lower.includes('captain') || lower.includes('pick') || lower.includes('vice')) {
        reply = `⚡ Fantasy Dream Pick & Captaincy Advice:\n• Captain Pick: ${striker} (High strike rate index in powerplay & middle overs)\n• Vice-Captain Pick: ${bowler} (High wicket probability in death overs)\n• Value Pick: All-rounders who bowl 3+ overs and bat in top 5.`;
      } else if (lower.includes('pitch') || lower.includes('condition') || lower.includes('weather') || lower.includes('ground') || lower.includes('venue')) {
        reply = `🏟️ Pitch & Venue Conditions:\n• Venue: ${activeMatch?.venue || "Lord's, London"}\n• Pitch Report: True bounce with early seam movement in first 6 overs, settling into a favorable batting surface under lights.\n• Par Score: ~178 in T20s / ~285 in ODIs.`;
      } else if (lower.includes('summary') || lower.includes('overs') || lower.includes('momentum') || lower.includes('status')) {
        reply = `🏏 Match Momentum Breakdown:\n• Fixture: ${teamA} vs ${teamB}\n• Current Scores: ${teamA} (${scoreA}) | ${teamB} (${scoreB})\n• Momentum Trend: Batting team control rate is at 78% with strong strike rotation over the last 5 overs.`;
      } else if (lower.includes('player') || lower.includes('batter') || lower.includes('bowler') || lower.includes('stats')) {
        reply = `👤 Live Player Breakdown:\n• Striker at Crease: ${striker} (Displaying high middle-overs attacking intent)\n• Current Bowler: ${bowler} (Targeting hard lengths outside off stump).\n• Matchup Edge: Batter strike rate vs spin is +18% above ground average.`;
      } else {
        reply = `💡 CricSense Tactical Breakdown for "${q}":\nIn ${teamA} vs ${teamB}, data indicates that dot-ball suppression in overs 7–15 is the deciding metric. Teams controlling phase 2 win 82% of matches at this venue.`;
      }

      setMessages((prev) => [...prev, { sender: 'ai', text: reply }]);
      setIsTyping(false);
    }, 600);
  };

  const suggestedChips = [
    "Who will win this match?",
    "Best fantasy captain & VC?",
    "Pitch & ground conditions?",
    "Match momentum summary",
  ];

  return (
    <div className="ai-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ai-modal-card">
        {/* Header */}
        <div className="ai-modal-header">
          <div className="ai-modal-title-row">
            <div className="ai-modal-avatar">
              <Icon name="sparkles" size={18} />
            </div>
            <div>
              <div className="ai-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                CricSense
                <span className="ai-modal-badge">AI PRO</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Real-time match intelligence</div>
            </div>
          </div>
          <button onClick={onClose} className="ai-modal-close" aria-label="Close CricSense">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Chat Thread */}
        <div className="ai-chat-thread" ref={threadRef}>
          {messages.map((m, i) => (
            <div key={i} className={`ai-msg ${m.sender}`}>
              <div className="ai-bubble">{m.text}</div>
            </div>
          ))}
          {isTyping && (
            <div className="ai-msg ai">
              <div className="ai-bubble">
                <div className="ai-typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        <div className="ai-chip-row">
          {suggestedChips.map((chip, idx) => (
            <button
              key={idx}
              className="ai-suggest-chip"
              onClick={() => handleSend(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="ai-input-row"
        >
          <input
            type="text"
            placeholder="Ask about match momentum, player matchups…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ai-text-input"
            id="cricsense-input"
          />
          <button type="submit" className="ai-send-btn">
            Ask →
          </button>
        </form>
      </div>
    </div>
  );
};

export default CricSenseModal;
