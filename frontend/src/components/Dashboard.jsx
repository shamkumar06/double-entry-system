import React, { useMemo } from 'react';
import { TrendingDown, TrendingUp, DollarSign, FileText, Activity, Layers, CheckCircle, PieChart, Edit3, Wallet, Target } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';
import { useProjectData } from '../context/ProjectDataContext';
import UsageCircle from './UsageCircle';
import EditOverviewModal from './EditOverviewModal';
import { parseDescription } from '../utils/descriptionParser';

export default function Dashboard({ projectId, projectName, phaseId, phaseName, onSelectPhase }) {
    const { formatCurrency } = useCurrency();
    const { project, journal, phaseFinances, projectFinances, loading } = useProjectData();

    // Compute stats for current view (phase or whole project) — pure derivation from context
    const stats = useMemo(() => {
        if (!project) return null;

        let totalFunds = 0, totalSpent = 0;

        if (phaseId) {
            // Phase view: use the pre-computed phaseFinances map (from /phase-financials endpoint)
            const pf = phaseFinances[phaseId];
            totalFunds = pf?.received || 0;
            totalSpent = pf?.spent || 0;
        } else {
            // Project overview: use backend-computed aggregates on the project object
            totalFunds = Number(projectFinances?.received) || 0;
            totalSpent = Number(projectFinances?.spent) || 0;
        }

        const remaining = totalFunds - totalSpent;

        // Cast Decimal fields from Prisma with Number() — raw Decimal objects break JS math
        const baseline = phaseId
            ? (Number(project.phases?.find(p => p.id === phaseId)?.estimatedBudget) || 0)
            : (Number(project.totalFunds) || 0);

        // Use received funds as the denominator when baseline is unavailable
        const denominator = baseline > 0 ? baseline : (Number(projectFinances?.received) || 0);
        const spentPct = denominator > 0 ? Math.min((totalSpent / denominator) * 100, 100) : 0;

        const activeJournal = phaseId
            ? journal.filter(tx => tx.phaseId === phaseId || tx.phase?.id === phaseId)
            : journal;

        return { totalFunds, totalSpent, remaining, spentPct, txCount: activeJournal.length, activeJournal };
    }, [project, journal, phaseFinances, projectFinances, phaseId]);

    // Phase breakdown using pre-computed phaseFinances (no loops, O(n) on phases array)
    const phaseBreakdown = useMemo(() => {
        if (phaseId || !project?.phases) return [];
        return project.phases.map(ph => {
            const pf = phaseFinances[ph.id] || { received: 0, spent: 0 };
            const phSpent = Number(pf.spent) || 0;
            const budget = Number(ph.estimatedBudget) || 0;  // Cast Decimal → Number
            const phPct = budget > 0 ? Math.min((phSpent / budget) * 100, 100) : 0;
            return {
                id: ph.id,
                name: ph.name,
                allocated: budget,
                spent: phSpent,
                remaining: budget - phSpent,
                pct: phPct
            };
        });
    }, [project, phaseFinances, phaseId]);

    const recentTxs = useMemo(() => {
        const source = phaseId
            ? journal.filter(tx => tx.phaseId === phaseId || tx.phase?.id === phaseId)
            : journal;
        return source.slice(0, 5);
    }, [journal, phaseId]);



    if (loading || !stats) return (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
            <UsageCircle percent={0} size={120} label="Loading..." />
            <p style={{ color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05rem', animation: 'pulse 1.5s infinite' }}>
                PREPARING DASHBOARD...
            </p>
        </div>
    );



    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Executive Hero Section */}
            <div className="dashboard-hero">
                <UsageCircle 
                    percent={stats?.spentPct || 0} 
                    size={220} 
                    strokeWidth={5}
                    label="Utilization"
                />
                
                <div style={{ 
                    flex: 1, 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.5rem'
                }}>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(15, 23, 42, 0.05)', color: 'var(--primary)' }}>
                            <Target size={20} />
                        </div>
                        <span className="hero-stat-label">Total Allocation</span>
                        <span className="hero-stat-value text-gradient">
                            {formatCurrency(phaseId
                                ? (Number(project?.phases?.find(p => p.id === phaseId)?.estimatedBudget) || 0)
                                : (Number(project?.totalFunds) || 0))}
                        </span>
                    </div>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                            <TrendingDown size={20} />
                        </div>
                        <span className="hero-stat-label">Total Spent</span>
                        <span className="hero-stat-value" style={{ color: 'var(--danger)' }}>
                            {formatCurrency(stats?.totalSpent)}
                        </span>
                    </div>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                            <Wallet size={20} />
                        </div>
                        <span className="hero-stat-label">Remaining Balance</span>
                        <span className="hero-stat-value" style={{ color: 'var(--success)' }}>
                            {formatCurrency(stats?.remaining)}
                        </span>
                    </div>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent)' }}>
                            <TrendingUp size={20} />
                        </div>
                        <span className="hero-stat-label">Received Funds</span>
                        <span className="hero-stat-value" style={{ color: 'var(--accent)' }}>
                            {formatCurrency(stats?.totalFunds)}
                        </span>
                    </div>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-muted)' }}>
                            <FileText size={20} />
                        </div>
                        <span className="hero-stat-label">Total Transactions</span>
                        <span className="hero-stat-value" style={{ color: 'var(--text-main)' }}>
                            {stats?.txCount || 0}
                        </span>
                    </div>
                </div>
            </div>

            {/* Phase-wise breakdown (only in All Phases view) */}
            {!phaseName && phaseBreakdown.length > 0 && (
                <div className="glass-panel phase-breakdown-panel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 1.5rem 0', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
                            <Layers size={20} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Phase-Wise Distribution</h3>
                    </div>
                    <div className="phase-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1.5rem 1.5rem 1.5rem' }}>
                        {phaseBreakdown.map(ph => (
                            <div key={ph.id}
                                onClick={() => onSelectPhase && onSelectPhase(ph)}
                                className="glass-panel phase-card premium-hover"
                                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface)' }}
                            >
                                <div className="phase-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span className="phase-name" style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>{ph.name}</span>
                                    <span className="phase-meta" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{formatCurrency(ph.spent)}</span> / {formatCurrency(ph.allocated)}
                                    </span>
                                </div>
                                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.5)' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${ph.pct}%`,
                                        background: ph.pct > 90
                                            ? 'var(--danger)'
                                            : 'linear-gradient(90deg, var(--accent) 0%, #60a5fa 100%)',
                                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.75rem' }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Rem: {formatCurrency(ph.remaining)}</span>
                                    <span style={{ color: ph.pct > 85 ? 'var(--danger)' : 'var(--accent)', fontWeight: 800 }}>
                                        {ph.pct.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent transactions */}
            <div className="glass-panel" style={{ padding: '2rem', border: '1px solid rgba(255,255,255,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
                            <Activity size={20} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Recent Transactions</h3>
                    </div>
                </div>
                {recentTxs.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.4)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No transactions yet. Click "+ New Transaction" to get started.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {recentTxs.map(tx => {
                            // Determine primary transaction type by analyzing its lines
                            const isInflow = tx.lines?.some(l => l.type === 'CREDIT' && ['REVENUE', 'LIABILITY', 'EQUITY'].includes(l.account?.type));
                            
                            // Find the most descriptive line (Expense or Revenue account) else fallback to the first
                            const primaryLine = tx.lines?.find(l => ['EXPENSE', 'REVENUE'].includes(l.account?.type)) || tx.lines?.[0];
                            const categoryName = primaryLine?.account?.name || 'Transaction';
                            const amount = primaryLine ? parseFloat(primaryLine.amount) : 0;
                            
                            // Format the date properly
                            const dateStr = new Date(tx.date).toLocaleDateString(undefined, { 
                                day: '2-digit', month: 'short', year: 'numeric' 
                            });

                            return (
                                <div key={tx.id} className="transaction-row premium-hover" style={{ 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                    padding: '1rem 1.25rem', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.4)', transition: 'all 0.2s ease', cursor: 'pointer'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ 
                                            width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: isInflow ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: isInflow ? 'var(--success)' : 'var(--danger)'
                                        }}>
                                            {isInflow ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem', marginBottom: '0.1rem' }}>{categoryName}</p>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{tx.description} <span style={{ opacity: 0.5, margin: '0 0.4rem' }}>•</span> {dateStr}</p>
                                        </div>
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: isInflow ? 'var(--success)' : 'var(--text-main)' }}>
                                        {isInflow ? '+' : '-'}{formatCurrency(amount)}
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
