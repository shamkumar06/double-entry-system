import React, { useMemo, useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, DollarSign, FileText, Activity, Layers, CheckCircle, PieChart, Edit3, Wallet, Target, Calculator } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';
import { useProjectData } from '../context/ProjectDataContext';
import UsageCircle from './UsageCircle';
import EditOverviewModal from './EditOverviewModal';
import { parseDescription } from '../utils/descriptionParser';

export default function Dashboard({ projectId, projectName, phaseId, phaseName, onSelectPhase, isSettledProp }) {
    const { formatCurrency } = useCurrency();
    const { project, journal, phaseFinances, projectFinances, loading } = useProjectData();

    // Derive settlement status for the active dashboard view
    const isSettled = useMemo(() => {
        if (isSettledProp !== undefined && phaseId) return isSettledProp;
        if (!project) return false;
        if (phaseId) {
            return project.phases?.find(p => p.id === phaseId)?.isSettled || false;
        }
        return project.phases?.length > 0 && project.phases.every(p => p.isSettled);
    }, [project, phaseId, isSettledProp]);

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
                pct: phPct,
                isSettled: ph.isSettled
            };
        });
    }, [project, phaseFinances, phaseId]);

    const recentTxs = useMemo(() => {
        const source = phaseId
            ? journal.filter(tx => tx.phaseId === phaseId || tx.phase?.id === phaseId)
            : journal;
        return source.slice(0, 5);
    }, [journal, phaseId]);



    // Auto-saving Notepad state
    const [note, setNote] = useState('');
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving'

    // Load note for the specific project / phase
    useEffect(() => {
        if (!projectId) return;
        const key = `notepad-note-${projectId}-${phaseId || 'all'}`;
        const savedNote = localStorage.getItem(key);
        setNote(savedNote || '');
        setSaveStatus('saved');
    }, [projectId, phaseId]);

    // Auto-save logic on change with a 500ms debounce
    const handleNoteChange = (e) => {
        const val = e.target.value;
        setNote(val);
        setSaveStatus('saving');
    };

    useEffect(() => {
        if (!projectId) return;
        const key = `notepad-note-${projectId}-${phaseId || 'all'}`;
        const timer = setTimeout(() => {
            localStorage.setItem(key, note);
            setSaveStatus('saved');
        }, 500);
        return () => clearTimeout(timer);
    }, [note, projectId, phaseId]);

    // Calculator state and operational key handler
    const [calcInput, setCalcInput] = useState('');
    
    const handleCalcKey = (key) => {
        if (key === 'C') {
            setCalcInput('');
        } else if (key === '=') {
            if (!calcInput) return;
            
            // Clean up and adjust negative numbers at the beginning
            let expr = calcInput.replace(/\s+/g, '');
            if (expr.startsWith('-')) {
                expr = '0' + expr;
            } else if (expr.startsWith('+')) {
                expr = '0' + expr;
            }
            
            if (!/^[0-9+\-*/.]*$/.test(expr)) {
                setCalcInput('Error');
                return;
            }
            
            try {
                // Tokenize digits/decimals vs operators
                const tokens = expr.match(/(\d+(?:\.\d+)?)|[+\-*/]/g);
                if (!tokens) {
                    setCalcInput('0');
                    return;
                }
                
                // 1. Resolve multiplication and division first
                const intermediate = [];
                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i];
                    if (token === '*' || token === '/') {
                        const prev = parseFloat(intermediate.pop());
                        const next = parseFloat(tokens[++i]);
                        if (isNaN(prev) || isNaN(next)) {
                            setCalcInput('Error');
                            return;
                        }
                        if (token === '/' && next === 0) {
                            setCalcInput('Error');
                            return;
                        }
                        intermediate.push(token === '*' ? prev * next : prev / next);
                    } else {
                        intermediate.push(token);
                    }
                }
                
                // 2. Resolve addition and subtraction
                let result = parseFloat(intermediate[0]);
                if (isNaN(result)) {
                    setCalcInput('Error');
                    return;
                }
                
                for (let i = 1; i < intermediate.length; i += 2) {
                    const operator = intermediate[i];
                    const nextVal = parseFloat(intermediate[i + 1]);
                    if (isNaN(nextVal)) {
                        setCalcInput('Error');
                        return;
                    }
                    
                    if (operator === '+') {
                        result += nextVal;
                    } else if (operator === '-') {
                        result -= nextVal;
                    } else {
                        setCalcInput('Error');
                        return;
                    }
                }
                
                setCalcInput(Number.isFinite(result) ? String(Number(result.toFixed(8))) : 'Error');
            } catch (err) {
                setCalcInput('Error');
            }
        } else {
            const operators = ['+', '-', '*', '/'];
            if (operators.includes(key) && operators.includes(calcInput.slice(-1))) {
                setCalcInput(calcInput.slice(0, -1) + key);
            } else {
                setCalcInput(prev => prev === 'Error' ? key : prev + key);
            }
        }
    };

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
            <div className={`dashboard-hero ${isSettled ? 'settled-theme' : ''}`} style={{ position: 'relative' }}>
                {isSettled && (
                    <div className="settled-seal-container" title="Accounts session is fully settled and verified">
                        <div className="settled-seal-ribbon-left"></div>
                        <div className="settled-seal-ribbon-right"></div>
                        <div className="settled-seal-wax">
                            <div className="settled-seal-inner">
                                <CheckCircle size={22} style={{ color: 'white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
                                <span style={{ fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.06em', marginTop: '3px', color: 'white' }}>SETTLED</span>
                            </div>
                        </div>
                    </div>
                )}

                <UsageCircle 
                    percent={stats?.spentPct || 0} 
                    size={220} 
                    strokeWidth={5}
                    label={isSettled ? "Settled" : "Utilization"}
                    isSettled={isSettled}
                />
                
                <div className="hero-stats-content">
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'var(--surface-hover)', color: 'var(--primary)' }}>
                            <Target size={20} />
                        </div>
                        <span className="hero-stat-label">Total Allocation</span>
                        <span className="hero-stat-value" style={{ color: 'var(--primary)' }}>
                            {formatCurrency(phaseId
                                ? (Number(project?.phases?.find(p => p.id === phaseId)?.estimatedBudget) || 0)
                                : (Number(project?.totalFunds) || 0))}
                        </span>
                    </div>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'var(--surface-hover)', color: isSettled ? 'var(--success)' : 'var(--danger)' }}>
                            <TrendingDown size={20} />
                        </div>
                        <span className="hero-stat-label">Total Spent</span>
                        <span className="hero-stat-value" style={{ color: isSettled ? 'var(--success)' : 'var(--danger)' }}>
                            {formatCurrency(stats?.totalSpent)}
                        </span>
                    </div>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'var(--surface-hover)', color: 'var(--success)' }}>
                            <Wallet size={20} />
                        </div>
                        <span className="hero-stat-label">Remaining Balance</span>
                        <span className="hero-stat-value" style={{ color: 'var(--success)' }}>
                            {formatCurrency(stats?.remaining)}
                        </span>
                    </div>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'var(--surface-hover)', color: 'var(--accent)' }}>
                            <TrendingUp size={20} />
                        </div>
                        <span className="hero-stat-label">Received Funds</span>
                        <span className="hero-stat-value" style={{ color: 'var(--accent)' }}>
                            {formatCurrency(stats?.totalFunds)}
                        </span>
                    </div>
                    <div className="stat-card-premium">
                        <div className="stat-icon-wrapper" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                            <FileText size={20} />
                        </div>
                        <span className="hero-stat-label">Total Transactions</span>
                        <span className="hero-stat-value" style={{ color: 'var(--text-main)' }}>
                            {stats?.txCount || 0}
                        </span>
                    </div>

                    {/* Glassmorphic Calculator */}
                    <div className="stat-card-premium" style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: '100%', 
                        minHeight: '160px',
                        padding: '1rem 1.25rem',
                        boxShadow: 'var(--card-shadow-inset)',
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                            <div className="stat-icon-wrapper" style={{ 
                                background: 'var(--surface-hover)', 
                                color: 'var(--success)',
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Calculator size={14} />
                            </div>
                            <span className="hero-stat-label" style={{ margin: 0, fontSize: '0.68rem' }}>Calculator</span>
                        </div>

                        {/* Calculator Display */}
                        <div style={{ 
                            background: 'var(--surface-hover)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '0.35rem 0.75rem',
                            minHeight: '28px',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            overflowX: 'auto',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                            marginBottom: '0.5rem',
                            fontFamily: 'monospace',
                            colorScheme: 'dark',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            {calcInput || '0'}
                        </div>

                        {/* Calculator Keys Grid */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(4, 1fr)', 
                            gap: '0.25rem',
                            flex: 1
                        }}>
                            {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map(key => {
                                const isOperator = ['/', '*', '-', '+', '='].includes(key);
                                const isClear = key === 'C';
                                return (
                                    <button 
                                        key={key}
                                        onClick={() => handleCalcKey(key)}
                                        style={{
                                            padding: '0.35rem 0',
                                            borderRadius: '6px',
                                            border: 'none',
                                            background: isClear 
                                                ? 'rgba(239, 68, 68, 0.15)' 
                                                : isOperator 
                                                    ? 'rgba(56, 189, 248, 0.15)' 
                                                    : 'var(--surface-hover)',
                                            color: isClear 
                                                ? '#f87171' 
                                                : isOperator 
                                                    ? '#38bdf8' 
                                                    : 'var(--text-main)',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                            e.currentTarget.style.background = isClear 
                                                ? 'rgba(239, 68, 68, 0.25)' 
                                                : isOperator 
                                                    ? 'rgba(56, 189, 248, 0.25)' 
                                                    : 'var(--border)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                            e.currentTarget.style.background = isClear 
                                                ? 'rgba(239, 68, 68, 0.15)' 
                                                : isOperator 
                                                    ? 'rgba(56, 189, 248, 0.15)' 
                                                    : 'var(--surface-hover)';
                                        }}
                                    >
                                        {key}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Notepad Panel */}
            <div className="glass-panel" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '10px' }}>
                            <Edit3 size={20} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Workspace Quick Notes</h3>
                    </div>
                    
                    {/* Auto-save Indicator badge */}
                    <span style={{ 
                        fontSize: '0.68rem', 
                        fontWeight: 700, 
                        color: saveStatus === 'saved' ? 'var(--success)' : 'var(--accent)',
                        opacity: 0.85,
                        background: saveStatus === 'saved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.3s ease',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <span style={{ 
                            width: '6px', 
                            height: '6px', 
                            borderRadius: '50%', 
                            background: saveStatus === 'saved' ? 'var(--success)' : 'var(--accent)',
                            display: 'inline-block',
                            animation: saveStatus === 'saving' ? 'pulse 1s infinite' : 'none'
                        }} />
                        {saveStatus === 'saved' ? 'All changes auto-saved' : 'Saving draft...'}
                    </span>
                </div>
                
                <textarea
                    value={note}
                    onChange={handleNoteChange}
                    placeholder="Write anything here—reminders, phase milestones, draft estimates, checklist items, or budget calculations. Your notes are stored securely and saved instantly as you type."
                    style={{
                        width: '100%',
                        minHeight: '140px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '16px',
                        outline: 'none',
                        resize: 'vertical',
                        color: 'var(--text-main)',
                        fontSize: '0.92rem',
                        lineHeight: '1.6',
                        fontFamily: 'inherit',
                        padding: '1.25rem',
                        colorScheme: 'dark',
                        boxShadow: 'var(--card-shadow-inset)',
                        transition: 'border-color 0.2s ease',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
            </div>

            {/* Phase-wise breakdown (only in All Phases view) */}
            {!phaseName && phaseBreakdown.length > 0 && (
                <div className="glass-panel phase-breakdown-panel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 1.5rem 0', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '10px' }}>
                            <Layers size={20} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Phase-Wise Distribution</h3>
                    </div>
                    <div className="phase-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1.5rem 1.5rem 1.5rem' }}>
                        {phaseBreakdown.map(ph => (
                            <div key={ph.id}
                                onClick={() => onSelectPhase && onSelectPhase(ph)}
                                className="glass-panel phase-card premium-hover"
                                style={{ 
                                    padding: '1.25rem 1.5rem', 
                                    cursor: 'pointer', 
                                    border: ph.isSettled ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border)', 
                                    borderRadius: '16px', 
                                    background: ph.isSettled ? 'linear-gradient(135deg, var(--surface) 0%, rgba(16, 185, 129, 0.01) 100%)' : 'var(--surface)'
                                }}
                            >
                                <div className="phase-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span className="phase-name" style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {ph.name} {ph.isSettled && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
                                    </span>
                                    <span className="phase-meta" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{formatCurrency(ph.spent)}</span> / {formatCurrency(ph.allocated)}
                                    </span>
                                </div>
                                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--progress-track)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${ph.pct}%`,
                                        background: ph.isSettled
                                            ? 'var(--success)'
                                            : ph.pct > 90
                                                ? 'var(--danger)'
                                                : 'linear-gradient(90deg, var(--accent) 0%, #60a5fa 100%)',
                                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.75rem' }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Rem: {formatCurrency(ph.remaining)}</span>
                                    <span style={{ color: ph.isSettled ? 'var(--success)' : ph.pct > 85 ? 'var(--danger)' : 'var(--accent)', fontWeight: 800 }}>
                                        {ph.isSettled ? 'Settled' : `${ph.pct.toFixed(0)}%`}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent transactions */}
            <div className="glass-panel" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
                            <Activity size={20} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Recent Transactions</h3>
                    </div>
                </div>
                {recentTxs.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--surface-hover)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
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
                                    padding: '1rem 1.25rem', borderRadius: '16px', background: 'var(--surface)',
                                    border: '1px solid var(--border)', transition: 'all 0.2s ease', cursor: 'pointer'
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
