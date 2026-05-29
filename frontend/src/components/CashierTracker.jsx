import React, { useState, useMemo } from 'react';
import { useProjectData } from '../context/ProjectDataContext';
import { useFormatting } from '../context/SettingsContext';
import { Users, Crown, User, ArrowDownRight, ChevronDown, ChevronRight, Activity, Clock, Wallet } from 'lucide-react';

export default function CashierTracker({ projectId, projectName, phaseId }) {
    const { formatCurrency, formatDate } = useFormatting();
    const { journal, members, cashierFinances, projectFinances, loading } = useProjectData();
    const [expandedCashier, setExpandedCashier] = useState(null);

    // Find guide from members list
    const guide = useMemo(() => members.find(m => m.role === 'GUIDE'), [members]);
    const students = useMemo(() => members.filter(m => m.role === 'STUDENT' && m.isActive !== false), [members]);

    // Build cashier data combining members + transaction data
    const cashierData = useMemo(() => {
        const data = {};
        // Initialize from members list
        members.forEach(m => {
            if (m.isActive === false) return;
            data[m.name] = {
                name: m.name,
                role: m.role,
                phone: m.phone,
                received: 0,
                spent: 0,
                holding: 0,
                transactions: 0,
            };
        });
        // Merge with actual transaction data
        Object.values(cashierFinances).forEach(cf => {
            if (data[cf.name]) {
                data[cf.name].received = cf.received;
                data[cf.name].spent = cf.spent;
                data[cf.name].holding = cf.holding;
                data[cf.name].transactions = cf.transactions;
            } else {
                data[cf.name] = { ...cf, role: 'STUDENT', phone: null };
            }
        });
        return data;
    }, [members, cashierFinances]);

    const guideData = guide ? cashierData[guide.name] : null;
    const studentData = useMemo(() => {
        return Object.values(cashierData)
            .filter(d => d.role === 'STUDENT')
            .sort((a, b) => b.spent - a.spent);
    }, [cashierData]);

    // Filter journal by cashier
    const getTransactionsForCashier = (name) => {
        const filtered = phaseId
            ? journal.filter(tx => tx.cashierName === name && (tx.phaseId === phaseId || tx.phase?.id === phaseId))
            : journal.filter(tx => tx.cashierName === name);
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    // Build timeline of all transactions sorted by date
    const timeline = useMemo(() => {
        const txs = phaseId
            ? journal.filter(tx => tx.cashierName && (tx.phaseId === phaseId || tx.phase?.id === phaseId))
            : journal.filter(tx => tx.cashierName);
        return txs.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 25);
    }, [journal, phaseId]);

    // Status color for cashier node
    const getStatusColor = (data) => {
        if (!data || data.transactions === 0) return 'var(--text-muted)';
        if (data.holding > 0) return '#10b981';
        if (data.spent > 0 && data.holding <= 0) return '#f59e0b';
        return 'var(--text-muted)';
    };

    const getStatusLabel = (data) => {
        if (!data || data.transactions === 0) return 'No Activity';
        if (data.holding > 0) return 'Holding Funds';
        if (data.spent > 0) return 'Fully Spent';
        return 'Inactive';
    };

    if (loading) {
        return (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users className="animate-spin" style={{ margin: '0 auto 1rem auto', color: 'var(--primary)' }} size={32} />
                <p>Loading cashier data...</p>
            </div>
        );
    }

    if (members.length === 0) {
        return (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1.3rem', fontWeight: 700 }}>No Team Members Yet</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
                    Go to <strong>Settings → Team Members</strong> to add your Faculty Guide and Student Sub-Cashiers first.
                </p>
            </div>
        );
    }

    return (
        <div className="cashier-tracker" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Section 1: Guide Hero */}
            {guideData && (
                <div className="cashier-guide-hero glass-panel" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05))',
                    borderLeft: '4px solid #6366f1',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '14px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                            fontSize: '1.2rem', fontWeight: 800, flexShrink: 0,
                        }}>
                            <Crown size={22} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1' }}>Faculty Guide · Main Cashier</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.1rem 0 0 0' }}>{guideData.name}</h3>
                        </div>
                    </div>
                    <div className="cashier-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                        <div className="cashier-stat-card" style={{ background: 'var(--surface)', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Total Allocation</p>
                            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>{formatCurrency(projectFinances?.received || 0)}</p>
                        </div>
                        <div className="cashier-stat-card" style={{ background: 'var(--surface)', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Total Spent</p>
                            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ef4444' }}>{formatCurrency(projectFinances?.spent || 0)}</p>
                        </div>
                        <div className="cashier-stat-card" style={{ background: 'var(--surface)', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Remaining</p>
                            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: (projectFinances?.balance || 0) >= 0 ? 'var(--text-main)' : '#ef4444' }}>{formatCurrency(projectFinances?.balance || 0)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 2: Money Flow Tree */}
            {guideData && studentData.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        <Activity size={18} color="#6366f1" />
                        Money Flow
                    </h4>
                    <div className="cashier-flow-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
                        {/* Guide Node */}
                        <div className="cashier-flow-node cashier-flow-guide" style={{
                            padding: '0.75rem 1.5rem', borderRadius: '14px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                            zIndex: 2, position: 'relative',
                        }}>
                            <Crown size={16} />
                            {guideData.name}
                        </div>

                        {/* Connector Line */}
                        <div style={{ width: '2px', height: '24px', background: 'var(--border)' }}></div>

                        {/* Branch Lines + Student Nodes */}
                        <div className="cashier-flow-branches" style={{
                            display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center',
                            position: 'relative', paddingTop: '8px',
                        }}>
                            {/* Horizontal connector */}
                            {studentData.length > 1 && (
                                <div style={{
                                    position: 'absolute', top: 0, left: '15%', right: '15%',
                                    height: '2px', background: 'var(--border)',
                                }}></div>
                            )}
                            {studentData.map((sd, i) => (
                                <div key={sd.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px' }}>
                                    {/* Vertical connector */}
                                    <div style={{ width: '2px', height: '16px', background: 'var(--border)' }}></div>
                                    <div style={{ position: 'relative', marginBottom: '2px' }}>
                                        <ArrowDownRight size={14} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                    {/* Student Card */}
                                    <div
                                        className="cashier-flow-node cashier-flow-student"
                                        onClick={() => setExpandedCashier(expandedCashier === sd.name ? null : sd.name)}
                                        style={{
                                            padding: '0.75rem 1rem', borderRadius: '14px',
                                            background: 'var(--surface)', border: '2px solid var(--border)',
                                            cursor: 'pointer', textAlign: 'center',
                                            transition: 'all 0.2s ease',
                                            minWidth: '130px',
                                            boxShadow: expandedCashier === sd.name ? '0 4px 20px rgba(0,0,0,0.1)' : 'var(--shadow-sm)',
                                            borderColor: expandedCashier === sd.name ? getStatusColor(sd) : 'var(--border)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', marginBottom: '0.35rem' }}>
                                            <span className="cashier-status-dot" style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                background: getStatusColor(sd),
                                                boxShadow: sd.holding > 0 ? `0 0 8px ${getStatusColor(sd)}` : 'none',
                                                animation: sd.holding > 0 ? 'gentlePulse 2s ease-in-out infinite' : 'none',
                                            }}></span>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>{sd.name}</span>
                                        </div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>{getStatusLabel(sd)}</p>
                                        <p style={{ fontSize: '1rem', fontWeight: 800, color: sd.holding > 0 ? '#10b981' : 'var(--text-main)' }}>
                                            {formatCurrency(Math.abs(sd.spent))}
                                        </p>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>spent</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Section 3: Student Cards Grid */}
            {studentData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {studentData.map(sd => {
                        const isExpanded = expandedCashier === sd.name;
                        const txList = isExpanded ? getTransactionsForCashier(sd.name) : [];
                        return (
                            <div key={sd.name} className="glass-panel cashier-accordion" style={{
                                padding: '1.25rem', cursor: 'pointer',
                                borderLeft: `4px solid ${getStatusColor(sd)}`,
                                transition: 'all 0.3s ease',
                            }}>
                                <div onClick={() => setExpandedCashier(isExpanded ? null : sd.name)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            background: `linear-gradient(135deg, ${getStatusColor(sd)}22, ${getStatusColor(sd)}11)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: getStatusColor(sd), fontWeight: 800, fontSize: '0.9rem',
                                        }}>
                                            {sd.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{sd.name}</p>
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sd.transactions} transaction{sd.transactions !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div>
                                            <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(sd.spent)}</p>
                                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>spent</p>
                                        </div>
                                        {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                                    </div>
                                </div>

                                {/* Expanded: Transaction List */}
                                {isExpanded && (
                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                        {txList.length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No transactions recorded.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                                                {txList.map(tx => {
                                                    const amt = Number(tx.lines?.[0]?.amount) || 0;
                                                    const isExpenseType = tx.lines?.some(l => l.account?.type === 'EXPENSE' && l.type === 'DEBIT');
                                                    return (
                                                        <div key={tx.id} style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: '0.6rem 0.75rem', borderRadius: '10px',
                                                            background: 'var(--surface-hover)', fontSize: '0.85rem',
                                                        }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {tx.description || 'No description'}
                                                                </p>
                                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                    {formatDate(tx.date)} · {tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || ''}
                                                                </p>
                                                            </div>
                                                            <span style={{
                                                                fontWeight: 700, flexShrink: 0, marginLeft: '0.75rem',
                                                                color: isExpenseType ? '#ef4444' : '#10b981',
                                                            }}>
                                                                {isExpenseType ? '-' : '+'}{formatCurrency(amt)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Section 4: Recent Activity Timeline */}
            {timeline.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        <Clock size={18} color="#f59e0b" />
                        Recent Activity
                    </h4>
                    <div className="cashier-timeline" style={{ position: 'relative', paddingLeft: '24px' }}>
                        {/* Vertical line */}
                        <div style={{
                            position: 'absolute', left: '7px', top: '8px', bottom: '8px',
                            width: '2px', background: 'var(--border)', borderRadius: '1px',
                        }}></div>

                        {timeline.map((tx, i) => {
                            const amt = Number(tx.lines?.[0]?.amount) || 0;
                            const isExpenseType = tx.lines?.some(l => l.account?.type === 'EXPENSE' && l.type === 'DEBIT');
                            const dotColor = isExpenseType ? '#ef4444' : '#10b981';
                            return (
                                <div key={tx.id} className="cashier-timeline-item" style={{
                                    position: 'relative', paddingBottom: i < timeline.length - 1 ? '1rem' : '0',
                                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                                }}>
                                    {/* Dot */}
                                    <div style={{
                                        position: 'absolute', left: '-20px', top: '6px',
                                        width: '10px', height: '10px', borderRadius: '50%',
                                        background: dotColor, border: '2px solid var(--surface)',
                                        boxShadow: `0 0 6px ${dotColor}44`,
                                    }}></div>
                                    {/* Content */}
                                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.25rem' }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                <span style={{
                                                    display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: '6px',
                                                    background: '#6366f122', color: '#6366f1', fontSize: '0.7rem', fontWeight: 700,
                                                    marginRight: '0.4rem', verticalAlign: 'middle',
                                                }}>{tx.cashierName}</span>
                                                {tx.description || 'Transaction'}
                                            </p>
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                {formatDate(tx.date)} · {tx.paymentMode || 'Cash'}
                                            </p>
                                        </div>
                                        <span style={{
                                            fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                                            color: isExpenseType ? '#ef4444' : '#10b981',
                                        }}>
                                            {isExpenseType ? '-' : '+'}{formatCurrency(amt)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
