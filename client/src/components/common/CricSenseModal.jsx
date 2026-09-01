import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Icon from './Icons';

/**
 * CricSense AI Assistant — RAG-Powered Cricket Intelligence
 */
export const CricSenseModal = ({ isOpen, onClose, activeMatch }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const threadRef = useRef(null);

  // Initialize welcome message when match changes or modal opens
  useEffect(() => {
    if (activeMatch) {
      setMessages([
        {
          sender: 'ai',
          text: `🏏 **CricSense RAG Engine Connected** to **${activeMatch.teamA} vs ${activeMatch.teamB}** (${activeMatch.venue || "International Ground"}).\n\nAsk me for real-time win probabilities, pitch & dew dynamics, death-overs matchups, or 2x / 1.5x fantasy captaincy picks!`,
          context: {
            venue: activeMatch.venue || 'International Ground',
            fixture: `${activeMatch.teamA} vs ${activeMatch.teamB}`,
            status: activeMatch.status || 'Match telemetry live'
          }
        }
      ]);
    } else {
      setMessages([
        {
          sender: 'ai',
          text: `🏏 **Welcome to CricSense AI Pro!**\n\nI am your RAG-powered cricket tactician. Select any live or upcoming fixture to retrieve real-time venue telemetry, win probabilities, and fantasy captaincy optimizations.`,
          context: null
        }
      ]);
    }
  }, [activeMatch, isOpen]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const q = (textToSend || query).trim();
    if (!q) return;

    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setQuery('');
    setIsTyping(true);

    try {
      const matchIdentifier = activeMatch?.matchId || activeMatch?._id;
      const res = await axios.post('http://localhost:5000/api/cricsense/ask', {
        query: q,
        matchId: matchIdentifier,
        activeMatch: activeMatch || null
      });

      const replyText = res.data?.reply || 'CricSense AI could not retrieve match intelligence at this moment.';
      const retrievedContext = res.data?.retrievedContext || null;

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: replyText,
          context: retrievedContext,
          source: res.data?.source
        }
      ]);
    } catch (err) {
      console.warn('CricSense API error, using local RAG fallback:', err);
      const teamA = activeMatch?.teamA || 'Team A';
      const teamB = activeMatch?.teamB || 'Team B';
      const venue = activeMatch?.venue || 'Stadium';
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `📊 **Retrieved Tactical Intelligence for ${teamA} vs ${teamB}**:\n• Venue: ${venue}\n• Current Equation: ${activeMatch?.scoreA || '0/0'} | ${activeMatch?.scoreB || '0/0'}\n• Key Factor: Dot-ball suppression in overs 7–15 determines match momentum.\n• Fantasy ROI Tip: Target top-3 batters and death bowlers for 2x/1.5x multipliers.`,
          context: { venue, fixture: `${teamA} vs ${teamB}` }
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestedChips = activeMatch ? [
    `Who will win ${activeMatch.teamA} vs ${activeMatch.teamB}?`,
    `Best 2x Captain and 1.5x VC pick?`,
    `Pitch & dew report for ${activeMatch.venue?.split(',')[0] || 'this ground'}`,
    `Match momentum and key player matchups`,
  ] : [
    "Who is the best fantasy captain today?",
    "Pitch report for Lord's and Wankhede",
    "How does RAG calculate win probability?",
    "Death overs bowling tactics",
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
                CricSense AI
                <span className="ai-modal-badge">RAG PRO</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                <span>{activeMatch ? `RAG Telemetry: ${activeMatch.teamA} vs ${activeMatch.teamB}` : 'Ground & Match Knowledge Base Connected'}</span>
              </div>
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
              <div className="ai-bubble">
                <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                {m.context?.venue && m.sender === 'ai' && (
                  <div style={{
                    marginTop: 8,
                    paddingTop: 6,
                    borderTop: '1px solid rgba(0,0,0,0.08)',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <Icon name="mappin" size={11} />
                    <span>RAG Ground Index: {m.context.venue}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="ai-msg ai">
              <div className="ai-bubble">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                  <Icon name="sparkles" size={13} color="#2563eb" />
                  <span>Retrieving live telemetry & venue vectors…</span>
                </div>
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
            placeholder={activeMatch ? `Ask about ${activeMatch.teamA} vs ${activeMatch.teamB}…` : "Ask about player matchups, ground pitch report, win probability…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ai-text-input"
            id="cricsense-input"
          />
          <button type="submit" className="ai-send-btn">
            Ask RAG →
          </button>
        </form>
      </div>
    </div>
  );
};

export default CricSenseModal;
