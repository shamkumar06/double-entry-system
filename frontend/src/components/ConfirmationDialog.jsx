import React, { useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function ConfirmationDialog({ 
    isOpen, 
    title = 'Confirm Action', 
    message = 'Are you sure you want to proceed?', 
    onConfirm, 
    onCancel, 
    confirmText = 'Confirm', 
    cancelText = 'Cancel',
    type = 'danger' // 'danger' | 'info' | 'success'
}) {
    const { settings } = useSettings();
    const isDark = settings?.theme === 'dark';

    // Close on Escape key press
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    // Type styling helpers
    const getThemeColors = () => {
        switch (type) {
            case 'success':
                return {
                    icon: <CheckCircle size={28} color="#10b981" />,
                    bg: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(16, 185, 129, 0.15)',
                    btnBg: '#10b981',
                    btnHover: '#059669',
                    btnText: '#ffffff',
                    glow: isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.2)'
                };
            case 'info':
                return {
                    icon: <Info size={28} color="var(--primary)" />,
                    bg: isDark ? 'rgba(2, 132, 199, 0.1)' : 'rgba(15, 23, 42, 0.05)',
                    border: isDark ? '1px solid rgba(2, 132, 199, 0.2)' : '1px solid rgba(15, 23, 42, 0.1)',
                    btnBg: 'var(--primary)',
                    btnHover: isDark ? '#0369a1' : 'var(--primary-hover)',
                    btnText: isDark ? '#020617' : '#ffffff',
                    glow: isDark ? 'rgba(2, 132, 199, 0.4)' : 'rgba(15, 23, 42, 0.15)'
                };
            case 'danger':
            default:
                return {
                    icon: <AlertTriangle size={28} color="#ef4444" />,
                    bg: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                    border: isDark ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(239, 68, 68, 0.15)',
                    btnBg: '#ef4444',
                    btnHover: '#dc2626',
                    btnText: '#ffffff',
                    glow: isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)'
                };
        }
    };

    const colors = getThemeColors();

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: isDark ? 'rgba(10, 15, 30, 0.8)' : 'rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(12px) saturate(160%)',
            animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={onCancel}>
            {/* Modal Body */}
            <div style={{
                position: 'relative',
                background: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(24px)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
                borderRadius: '24px',
                maxWidth: '480px',
                width: '100%',
                padding: '2rem',
                boxShadow: isDark 
                    ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : '0 25px 50px -12px rgba(15, 23, 42, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
                transform: 'scale(1)',
                animation: 'zoomIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                color: 'var(--text-main)'
            }}
            onClick={e => e.stopPropagation()}>
                
                {/* Close X Button */}
                <button 
                    onClick={onCancel}
                    style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <X size={18} />
                </button>

                {/* Header with Icon and Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '16px',
                        background: colors.bg,
                        border: colors.border,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        {colors.icon}
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            {title}
                        </h4>
                    </div>
                </div>

                {/* Message Body */}
                <div style={{
                    fontSize: '0.925rem',
                    color: 'var(--text-muted)',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line'
                }}>
                    {message}
                </div>

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.85rem',
                    marginTop: '0.5rem'
                }}>
                    <button 
                        onClick={onCancel}
                        style={{
                            padding: '0.65rem 1.5rem',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={onConfirm}
                        style={{
                            padding: '0.65rem 1.75rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: colors.btnBg,
                            color: colors.btnText,
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: `0 4px 12px ${colors.glow}`
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = colors.btnHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = colors.btnBg; e.currentTarget.style.transform = 'none'; }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
