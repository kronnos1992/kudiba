import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  elevation?: 'flat' | 'glow';
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  elevation = 'flat',
  className = '',
  ...props
}) => {
  const elevationClass =
    elevation === 'glow'
      ? 'shadow-[0_12px_36px_rgba(13,92,58,0.12)] border-emerald-500/30'
      : 'shadow-sm';

  return (
    <div
      className={`bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl transition-all duration-200 hover:border-emerald-600/30 ${elevationClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
