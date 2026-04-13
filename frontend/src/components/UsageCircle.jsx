import React, { useEffect, useState } from 'react';

const UsageCircle = ({ percent = 0, size = 180, strokeWidth = 6, label = "Utilization" }) => {
  const [offset, setOffset] = useState(0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const progressOffset = ((100 - percent) / 100) * circumference;
    setOffset(progressOffset);
  }, [percent, circumference]);

  const getColor = (p) => {
    if (p > 90) return 'var(--danger)';
    if (p > 75) return 'var(--warning)';
    return 'var(--accent)'; // Professional blue accent
  };

  const currentColor = getColor(percent);

  return (
    <div className="usage-circle-container" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        className="usage-circle-svg"
      >
        {/* Background Track - Very subtle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="var(--surface-hover)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Progress Path - Precision line */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={currentColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ 
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))'
          }}
          transform="rotate(-90 60 60)"
        />

        {/* Center Content */}
        <foreignObject x="0" y="0" width="120" height="120">
          <div className="usage-circle-content" style={{ padding: '0.5rem' }}>
            <span className="usage-circle-percent" style={{ 
                color: 'var(--primary)', 
                fontSize: percent < 10 ? '1.5rem' : '1.8rem',
                letterSpacing: '-0.03em'
            }}>
              {percent <= 0
                ? '0%'
                : percent < 1
                  ? '< 1%'
                  : percent < 10
                    ? `${percent.toFixed(1)}%`
                    : `${Math.round(percent)}%`}
            </span>
            <span className="usage-circle-label" style={{ 
                fontSize: '0.65rem',
                opacity: 0.6,
                marginTop: '0.1rem'
            }}>
                {label}
            </span>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
};

export default UsageCircle;
