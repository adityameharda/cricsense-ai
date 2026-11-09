import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import Icon from './Icons';

const welcomeFor = (match) => {
  if (match?.teamA) {
    return {
      sender: 'ai',
      text: `🏏 **CricSense** is looking at **${match.teamA} vs ${match.teamB}**${match.venue ? ` (${match.venue})` : ''}.\n\nAsk about the score and equation, the scorecard, squads and playing XIs, fantasy picks, or any player's career stats. Follow-up questions work too.`,
      context: null,
    };
  }
  return {
    sender: 'ai',
    text: `🏏 **Welcome to CricSense!**\n\nAsk about any match by team ("Ind score", "Aussies", "Proteas squads") or any player ("Kohli career stats", "Bumrah in Tests"). Follow-up questions remember what we were talking about. Answers come only from real Cricbuzz data.`,
    context: null,
  };
};

/**
 * CricSense chat. `activeMatch` is the match whose page the user is on (from Header);
 * the conversation (and what it was last about) survives closing and reopening the
 * modal, and starts fresh when the user moves to a different match page.
 */
export const CricSenseModal = ({ isOpen, onClose, activeMatch }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState(() => [welcomeFor(activeMatch)]);
  const [convContext, setConvContext] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const threadRef = useRef(null);

  const pageMatchId = activeMatch?.matchId ? String(activeMatch.matchId) : null;
  const fixture = activeMatch?.teamA ? `${activeMatch.teamA} vs ${activeMatch.teamB}` : null;

  // New match page → new conversation
  useEffect(() => {
    setMessages([welcomeFor(activeMatch)]);
    setConvContext({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMatchId]);

  // Match details arrived after the page id: refresh the greeting if nothing was asked yet
  useEffect(() => {
    setMessages((prev) => (prev.length === 1 ? [welcomeFor(activeMatch)] : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  if (!isOpen) return null;

  const resetChat = () => {
    setMessages([welcomeFor(activeMatch)]);
    setConvContext({});
  };

  const handleSend = async (textToSend) => {
    const q = (textToSend || query).trim();
    if (!q || isTyping) return;

    // Recent turns (skip the greeting) so follow-ups like "what about him?" make sense
    const history = messages.slice(1).slice(-8).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      text: String(m.text).slice(0, 1500),
    }));

    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setQuery('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/cricsense/ask`, {
        query: q,
        matchId: pageMatchId,
        context: convContext,
        history,
      });

      const replyText = res.data?.reply || 'CricSense could not answer that right now.';
      const rc = res.data?.retrievedContext || null;
      setConvContext((prev) => ({
        matchId: rc?.matchId || prev.matchId,
        playerId: rc?.playerId || prev.playerId,
      }));
      setMessages((prev) => [...prev, { sender: 'ai', text: replyText, context: rc }]);
    } catch (err) {
      console.warn('CricSense API error:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: err.response?.data?.error || "Sorry, CricSense couldn't reach the server just now. Please try again in a moment.",
          context: null,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestedChips = activeMatch?.teamA ? [
    activeMatch.matchStarted && !activeMatch.matchEnded ? 'What is the equation right now?' : activeMatch.matchEnded ? 'What was the result?' : 'When does it start?',
    activeMatch.matchStarted ? 'Top performers so far' : 'Show me the squads',
    'Fantasy captain and vice-captain options',
    activeMatch.matchStarted && !activeMatch.matchEnded ? 'Who is at the crease?' : 'Is the playing XI announced?',
  ] : [
    'Which matches are live right now?',
    'Ind score',
    'Kohli career stats',
    'Bumrah in Tests',
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
                <span className="ai-modal-badge">LIVE DATA</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                <span>{fixture || 'Matches, squads and player stats'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {messages.length > 1 && (
              <button onClick={resetChat} className="ai-new-chat-btn" title="Start a new conversation">
                New chat
              </button>
            )}
            <button onClick={onClose} className="ai-modal-close" aria-label="Close CricSense">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Chat Thread */}
        <div className="ai-chat-thread" ref={threadRef}>
          {messages.map((m, i) => (
            <div key={i} className={`ai-msg ${m.sender}`}>
              <div className="ai-bubble">
                <div style={{ whiteSpace: 'pre-line' }}>
                  {/* Render **bold** segments; everything else as plain text */}
                  {String(m.text).split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={j}>{part.slice(2, -2)}</strong>
                      : <React.Fragment key={j}>{part.replace(/(^|\s)_([^_]+)_(?=\s|$|[.,])/g, '$1$2')}</React.Fragment>
                  )}
                </div>
                {m.sender === 'ai' && (m.context?.fixture || m.context?.player) && (
                  <div className="ai-msg-source">
                    <Icon name={m.context.player ? 'user' : 'mappin'} size={11} />
                    <span>
                      {m.context.player && (
                        m.context.profileUrl
                          ? <a href={m.context.profileUrl} target="_blank" rel="noopener noreferrer">{m.context.player}</a>
                          : m.context.player
                      )}
                      {m.context.player && m.context.fixture ? ' · ' : ''}
                      {m.context.fixture || ''}
                      {m.context.source ? ` · ${m.context.source}` : ''}
                    </span>
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
                  <span>Checking live Cricbuzz data…</span>
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
              disabled={isTyping}
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
            placeholder={fixture ? `Ask about ${fixture} or any player…` : 'Ask about a match or player, e.g. "Ind score"'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ai-text-input"
            id="cricsense-input"
            maxLength={500}
          />
          <button type="submit" className="ai-send-btn" disabled={isTyping}>
            Ask →
          </button>
        </form>
      </div>
    </div>
  );
};

export default CricSenseModal;
