import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { TrendingDown, TrendingUp, DollarSign, FileText, Activity, Layers, CheckCircle } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';

export default function Dashboard({ projectId, projectName, phaseId, phaseName, onSelectPhase }) {
    const { formatCurrency } = useCurrency();
    const [stats, setStats] = useState(null);
    const [project, setProject] = useState(null);
    const [recentTxs, setRecentTxs] = useState([]);
    const [phaseBreakdown, setPhaseBreakdown] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // FETCH USING LOGICAL IDs
                const [projects, journal, categoriesData] = await Promise.all([
                    accountingApi.listProjects(),
                    accountingApi.getJournal(projectId, phaseId),
                    accountingApi.listCategories()
                ]);

                // 1. Build Master Type Map (ID -> Type)
                const typeMap = {};
                categoriesData.forEach(c => {
                    typeMap[String(c.code)] = c.account_type;
                });

                // Find this project by logical ID
                const project = projects.find(p => p.logical_id === projectId);
                if (!project) throw new Error("Project not found");

                // getJournal(projectId, phaseId) already filters by phase
                const filteredJournal = journal;

                const getTxType = (tx) => {
                    if (tx.account_type) return tx.account_type;
                    return typeMap[String(tx.category_id)] || 'Expense';
                };

                // Calculate stats based on IDs
                const totalInflow = journal
                    .filter(tx => ['Revenue', 'Liability', 'Equity'].includes(getTxType(tx)))
                    .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);
                
                const totalOutflow = journal
                    .filter(tx => ['Expense', 'Asset'].includes(getTxType(tx)))
                    .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);

                let totalFunds = totalInflow; 
                let totalSpent = totalOutflow;
                let remaining = totalFunds - totalSpent;

                if (!phaseId) {
                    const breakdown = [];
                    if (project?.phases) {
                        Object.values(project.phases).forEach(ph => {
                            const phInflow = journal
                                .filter(tx => tx.phase_id === ph.phase_id && ['Revenue', 'Liability', 'Equity'].includes(getTxType(tx)))
                                .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);
                            const phSpent = journal
                                .filter(tx => tx.phase_id === ph.phase_id && ['Expense', 'Asset'].includes(getTxType(tx)))
                                .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);
                            
                            const phTotalFunds = phInflow;
                            const phRemaining = phTotalFunds - phSpent;
                            const phPct = phTotalFunds > 0 ? Math.min((phSpent / phTotalFunds) * 100, 100) : 0;
                            
                            breakdown.push({
                                id: ph.phase_id,
                                name: ph.name,
                                allocated: phTotalFunds,
                                spent: phSpent,
                                remaining: phRemaining,
                                pct: phPct
                            });
                        });
                    }
                    setPhaseBreakdown(breakdown);
                }

                const spentPct = totalFunds > 0 ? Math.min((totalSpent / totalFunds) * 100, 100) : 0;

                setProject(project);
                setStats({ totalFunds, remaining, totalSpent, spentPct, txCount: filteredJournal.length });
                setRecentTxs(filteredJournal.slice(-5).reverse());
            } catch (e) {
                console.error("Dashboard load error", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [projectId, phaseId]);

    if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>;


    const isSettled = project?.phases && phaseId 
        ? Object.values(project.phases).find(p => p.phase_id === phaseId)?.is_settled 
        : false;

    const statCards = [
        {
            label: phaseName ? 'Phase Allocation' : 'Project Budget',
            value: formatCurrency(phaseId && project?.phases 
                ? (Object.values(project.phases).find(p => p.phase_id === phaseId)?.allocated_funds || 0)
                : (project?.total_funds || 0)),
            icon: <Layers size={22} />,
            color: '#6366f1'
        },
        {
            label: 'Received Funds',
            value: formatCurrency(stats?.totalFunds),
            icon: <DollarSign size={22} />,
            color: '#818cf8'
        },
        {
            label: 'Total Spent',
            value: formatCurrency(stats?.totalSpent),
            icon: <TrendingDown size={22} />,
            color: '#ef4444'
        },
        {
            label: 'Remaining Balance',
            value: formatCurrency(stats?.remaining),
            icon: <TrendingUp size={22} />,
            color: '#10b981'
        },
        {
            label: 'Transactions',
            value: stats?.txCount || 0,
            icon: <FileText size={22} />,
            color: '#f59e0b'
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Phase Header with Settle Action */}
            {phaseName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '-1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{phaseName} Dashboard</h2>
                        {isSettled && (
                            <span style={{ 
                                display: 'flex', alignItems: 'center', gap: '0.3rem',
                                background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', 
                                padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700
                            }}>
                                <CheckCircle size={14} /> SETTLED
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {statCards.map(card => (
                    <div key={card.label} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{card.label}</span>
                            <div style={{ color: card.color, background: `${card.color}20`, padding: '0.4rem', borderRadius: '8px' }}>
                                {card.icon}
                            </div>
                        </div>
                        <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Budget progress bar */}
            {stats?.totalFunds > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 600 }}>Budget Utilization</span>
                        <span style={{ color: stats.spentPct > 85 ? 'var(--danger)' : 'var(--secondary)', fontWeight: 600 }}>
                            {stats.spentPct.toFixed(1)}%
                        </span>
                    </div>
                    <div style={{ height: '10px', borderRadius: '5px', background: 'var(--surface-hover)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${stats.spentPct}%`,
                            borderRadius: '5px',
                            background: stats.spentPct > 85
                                ? 'linear-gradient(to right, #f59e0b, #ef4444)'
                                : 'linear-gradient(to right, #4f46e5, #10b981)',
                            transition: 'width 0.6s ease'
                        }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>{formatCurrency(0)}</span>
                        <span>{formatCurrency(stats.totalFunds)}</span>
                    </div>
                </div>
            )}

            {/* Phase-wise breakdown (only in All Phases view) */}
            {!phaseName && phaseBreakdown.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontWeight: 600, marginBottom: '1.25rem' }}>Phase-Wise Distribution</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {phaseBreakdown.map(ph => (
                            <div key={ph.id}
                                onClick={() => onSelectPhase && onSelectPhase(ph)}
                                style={{ padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s ease' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <span style={{ fontWeight: 500 }}>{ph.name}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {formatCurrency(ph.spent)} / {formatCurrency(ph.allocated)}
                                    </span>
                                </div>
                                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-hover)', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${ph.pct}%`,
                                        borderRadius: '4px',
                                        background: ph.pct > 85
                                            ? 'linear-gradient(to right, #f59e0b, #ef4444)'
                                            : 'linear-gradient(to right, #6366f1, #38bdf8)',
                                        transition: 'width 0.6s ease'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <span>Remaining: {formatCurrency(ph.remaining)}</span>
                                    <span style={{ color: ph.pct > 85 ? 'var(--danger)' : 'var(--secondary)', fontWeight: 600 }}>
                                        {ph.pct.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent transactions */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <Activity size={18} color="var(--primary)" />
                    <h3 style={{ fontWeight: 600 }}>Recent Transactions</h3>
                </div>
                {recentTxs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No transactions yet. Click "+ New Transaction" to get started.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {recentTxs.map(tx => {
                            const isInflow = ['Revenue', 'Liability', 'Equity'].includes(tx.account_type);
                            return (
                                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', background: 'var(--surface)' }}>
                                    <div>
                                        <p style={{ fontWeight: 500 }}>{tx.category_name}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.from_name} ➔ {tx.to_name} · {tx.transaction_date}</p>
                                    </div>
                                    <span style={{ fontWeight: 600, color: isInflow ? 'var(--secondary)' : 'var(--danger)' }}>
                                        {isInflow ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
