import React from 'react';
import Icon from './Icons';

export const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="logout-modal-card animate-pop">
        <div className="logout-modal-icon-wrap">
          <Icon name="log-out" size={26} />
        </div>

        <h3 className="logout-modal-title">Sign Out of CricScore?</h3>
        <p className="logout-modal-desc">
          Are you sure you want to log out? You will need to sign in again to manage your fantasy squads and view private contests.
        </p>

        <div className="logout-modal-actions">
          <button
            type="button"
            className="logout-modal-cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="logout-modal-confirm-btn"
            onClick={onConfirm}
          >
            Yes, Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
