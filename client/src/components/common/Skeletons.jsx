import React from 'react';

const shimmerStyle = {
  background: 'linear-gradient(90deg, var(--bg-muted) 25%, var(--bg-subtle) 50%, var(--bg-muted) 75%)',
  backgroundSize: '400px 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: 'var(--radius-sm)',
};

const Skel = ({ h = 14, w = '100%', style = {} }) => (
  <div style={{ height: h, width: w, ...shimmerStyle, ...style }} />
);

export const CardSkeleton = () => (
  <div className="skeleton-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Skel h={12} w="55%" />
      <Skel h={20} w="22%" style={{ borderRadius: 'var(--radius-full)' }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skel h={14} w="50%" />
        <Skel h={14} w="25%" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skel h={14} w="50%" />
        <Skel h={14} w="25%" />
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <Skel h={32} w="50%" style={{ borderRadius: 'var(--radius-md)' }} />
      <Skel h={32} w="50%" style={{ borderRadius: 'var(--radius-md)' }} />
    </div>
  </div>
);

export const HeroSkeleton = () => (
  <div
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-2xl)',
      padding: '28px 32px',
      boxShadow: 'var(--shadow-sm)',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <Skel h={12} w="38%" />
      <Skel h={24} w="16%" style={{ borderRadius: 'var(--radius-full)' }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skel h={24} w="70%" />
        <Skel h={32} w="55%" />
      </div>
      <Skel h={36} w={36} style={{ borderRadius: '50%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <Skel h={24} w="70%" />
        <Skel h={32} w="55%" />
      </div>
    </div>
  </div>
);
