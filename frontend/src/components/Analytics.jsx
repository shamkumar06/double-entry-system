import React, { useMemo, useState } from 'react';
import { useProjectData } from '../context/ProjectDataContext';
import { useFormatting } from '../context/SettingsContext';
import { 
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, ReferenceLine,
    ComposedChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Activity, DollarSign, PieChart as PieChartIcon, TrendingUp, TrendingDown, Target, FileText, Percent, Tag, Truck, Wallet, Users, BarChart3, Layers, LayoutGrid, Crown } from 'lucide-react';

const CHART_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#0ea5e9', '#84cc16', '#eab308'];

export default function Analytics({ projectId, projectName, phaseId }) {
    const { formatCurrency, formatDate } = useFormatting();
    const { journal, phaseFinances, projectFinances, members, cashierFinances, loading } = useProjectData();
    const [hiddenCategories, setHiddenCategories] = useState({});
    const [hiddenPhases, setHiddenPhases] = useState({});
    const [lastClickedPhase, setLastClickedPhase] = useState(null);

    // Use exact totals calculated by the context
    const totalIncome = phaseId ? (phaseFinances[phaseId]?.received || 0) : (projectFinances?.received || 0);
    const totalExpense = phaseId ? (phaseFinances[phaseId]?.spent || 0) : (projectFinances?.spent || 0);
    const balance = phaseId ? (phaseFinances[phaseId]?.balance || 0) : (projectFinances?.balance || 0);

    // Fund Flow Pipeline Calculation
    const fundFlowData = useMemo(() => {
        const totalFunding = totalIncome;
        const totalSpentAmount = totalExpense;

        let guideReceived = 0;
        let studentReceived = 0;
        let guideName = 'Main Cashier (Guide)';
        let students = [];

        if (members && cashierFinances) {
            const guide = members.find(m => m.role === 'GUIDE');
            if (guide) {
                guideName = guide.name;
                if (cashierFinances[guide.name]) {
                    guideReceived = cashierFinances[guide.name].received;
                }
            }

            members.forEach(m => {
                if (m.role === 'STUDENT' && cashierFinances[m.name]) {
                    studentReceived += cashierFinances[m.name].received;
                    students.push({ name: m.name, received: cashierFinances[m.name].received });
                }
            });
        }

        return {
            totalFunding,
            guideName,
            guideReceived,
            studentReceived,
            students,
            totalSpent: totalSpentAmount
        };
    }, [totalIncome, totalExpense, members, cashierFinances]);

    const { 
        expenseByCategory,
        dailyData,
        topVendors,
        paymentModes,
        cashierLeaderboard,
        totalTxns,
        totalTaxes,
        totalDiscounts
    } = useMemo(() => {
        const activeJournal = phaseId ? journal.filter(tx => tx.phaseId === phaseId || tx.phase?.id === phaseId) : journal;
        let tExpense = 0;
        let tTaxes = 0;
        let tDiscounts = 0;
        
        const expMap = {};
        const dateMap = {};
        const vendorMap = {};
        const modeMap = {};
        const cashierMap = {};

        activeJournal.forEach(tx => {
            const amount = Number(tx.lines?.[0]?.amount) || 0;
            const primaryAccount = tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || 'Unknown';
            const expenseLine = tx.lines?.find(l => l.account?.type === 'EXPENSE' && l.type === 'DEBIT');
            
            // KPIs
            tTaxes += (Number(tx.cgst) || 0) + (Number(tx.sgst) || 0) + (Number(tx.igst) || 0);
            tDiscounts += (Number(tx.discount) || 0);

            const dateStr = new Date(tx.date).toLocaleDateString();
            if (!dateMap[dateStr]) {
                dateMap[dateStr] = { date: dateStr, timestamp: new Date(tx.date).getTime(), expense: 0, count: 0 };
            }
            dateMap[dateStr].count += 1;

            if (expenseLine || tx.lines?.find(l => l.account?.type === 'ASSET' && l.type === 'CREDIT')) {
                const categoryName = expenseLine ? expenseLine.account.name : primaryAccount;
                tExpense += amount;
                expMap[categoryName] = (expMap[categoryName] || 0) + amount;
                dateMap[dateStr].expense += amount;
                
                // Top Vendors
                if (tx.toEntity) {
                    vendorMap[tx.toEntity] = (vendorMap[tx.toEntity] || 0) + amount;
                }
                
                // Payment Modes
                const mode = tx.paymentMode || 'Cash';
                modeMap[mode] = (modeMap[mode] || 0) + amount;
                
                // Cashier
                const cashier = tx.cashierName || 'Unassigned';
                cashierMap[cashier] = (cashierMap[cashier] || 0) + amount;
            }
        });

        const expCategoryData = Object.entries(expMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        const vendorsData = Object.entries(vendorMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
        const modesData = Object.entries(modeMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        const cashiersData = Object.entries(cashierMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        
        const dailyArr = Object.values(dateMap).sort((a,b) => a.timestamp - b.timestamp);
        let cumExpense = 0;
        dailyArr.forEach(d => {
            cumExpense += d.expense;
            d.cumulativeExpense = cumExpense;
        });

        return {
            expenseByCategory: expCategoryData,
            dailyData: dailyArr,
            topVendors: vendorsData,
            paymentModes: modesData,
            cashierLeaderboard: cashiersData,
            totalTxns: activeJournal.length,
            totalTaxes: tTaxes,
            totalDiscounts: tDiscounts
        };
    }, [journal, phaseId]);

    // Phase-Wise Analytics (Only computed if viewing at Project Level)
    const { phaseComparisonData, categoryByPhaseData, netCashFlowData, radarData, categoriesSet, allPhases } = useMemo(() => {
        if (phaseId) return { phaseComparisonData: [], categoryByPhaseData: [], netCashFlowData: [], radarData: [], categoriesSet: [], allPhases: [] };

        const allPhases = Object.values(phaseFinances).map(ph => ph.name || 'Unknown Phase');

        // 1. Phase Budget vs Spend
        const phaseComparisonData = Object.values(phaseFinances).map(ph => ({
            name: ph.name || 'Unknown Phase',
            received: ph.received || 0,
            spent: ph.spent || 0
        }));

        // 2. Category Spending by Phase
        const phaseCategoryMap = {};
        const categorySet = new Set();
        
        // 3. Net Cash Flow
        const cashFlowMap = {};

        // 4. Radar Data
        const radarMap = {};

        journal.forEach(tx => {
            const phName = tx.phase?.name || 'Unassigned';
            if (hiddenPhases[phName]) return;

            const amount = Number(tx.lines?.[0]?.amount) || 0;
            const expenseLine = tx.lines?.find(l => l.account?.type === 'EXPENSE' && l.type === 'DEBIT');
            
            // Timeline
            const dateStr = new Date(tx.date).toLocaleDateString();
            if (!cashFlowMap[dateStr]) cashFlowMap[dateStr] = { date: dateStr, timestamp: new Date(tx.date).getTime(), income: 0, expense: 0 };
            
            // Check if Income
            const isIncome = tx.lines?.some(l => l.account?.name === 'Main Cash Account' && l.type === 'DEBIT') && tx.lines?.some(l => l.account?.type === 'INCOME' || l.account?.name === 'Funding Source');
            if (isIncome) {
                cashFlowMap[dateStr].income += amount;
            }

            if (expenseLine) {
                const category = expenseLine.account.name;
                
                // Stacked Bar
                if (!phaseCategoryMap[phName]) phaseCategoryMap[phName] = { name: phName };
                phaseCategoryMap[phName][category] = (phaseCategoryMap[phName][category] || 0) + amount;
                categorySet.add(category);
                
                // Timeline
                cashFlowMap[dateStr].expense += amount;
                
                // Radar
                radarMap[category] = (radarMap[category] || 0) + amount;
            }
        });

        let categoryByPhaseData = Object.values(phaseCategoryMap);
        categoryByPhaseData.sort((a, b) => {
            const indexA = phaseComparisonData.findIndex(p => p.name === a.name);
            const indexB = phaseComparisonData.findIndex(p => p.name === b.name);
            return indexA - indexB;
        });
        const categories = Array.from(categorySet);
        
        const netCashFlowData = Object.values(cashFlowMap).sort((a,b) => a.timestamp - b.timestamp);
        
        const radarData = Object.entries(radarMap).map(([subject, A]) => ({ subject, A })).sort((a,b) => b.A - a.A).slice(0, 6); // Top 6 categories

        return { phaseComparisonData, categoryByPhaseData, netCashFlowData, radarData, categoriesSet: categories, allPhases };
    }, [journal, phaseFinances, phaseId, hiddenPhases]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-main)' }}>{label || payload[0].name}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ margin: '0.25rem 0', color: entry.color, fontWeight: 500 }}>
                            {entry.name}: {formatCurrency(entry.value)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Activity className="animate-spin" style={{ margin: '0 auto 1rem auto', color: 'var(--primary)' }} size={32} />
                <p>Analyzing financial data...</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
            
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--success)' }}>
                    <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: 'var(--success)' }}>
                        <Target size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Funding</p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.25rem 0 0 0' }}>{formatCurrency(totalIncome)}</h3>
                    </div>
                </div>
                
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: 'var(--danger)' }}>
                        <TrendingDown size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spent</p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.25rem 0 0 0' }}>{formatCurrency(totalExpense)}</h3>
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ padding: '1rem', background: 'rgba(2, 132, 199, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining Budget</p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: balance >= 0 ? 'var(--text-main)' : 'var(--danger)', margin: '0.25rem 0 0 0' }}>
                            {formatCurrency(balance)}
                        </h3>
                    </div>
                </div>
                
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent)' }}>
                    <div style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: 'var(--accent)' }}>
                        <FileText size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Transactions</p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.25rem 0 0 0' }}>{totalTxns}</h3>
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: '#f59e0b' }}>
                        <Percent size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Taxes & GST</p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.25rem 0 0 0' }}>{formatCurrency(totalTaxes)}</h3>
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #14b8a6' }}>
                    <div style={{ padding: '1rem', background: 'rgba(20, 184, 166, 0.1)', borderRadius: '12px', color: '#14b8a6' }}>
                        <Tag size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Discounts</p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.25rem 0 0 0' }}>{formatCurrency(totalDiscounts)}</h3>
                    </div>
                </div>
            </div>

            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Row 1: 3-Split */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 30%', minWidth: '320px', display: 'flex' }}>
                        {/* Expense Breakdown */}
                <div className="glass-panel" style={{ width: "100%", padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <PieChartIcon size={20} color="var(--danger)" />
                        Expense Breakdown
                    </h4>
                    {expenseByCategory.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                            <div style={{ height: 320, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 320 }}>
                                    <PieChart>
                                        <Pie
                                            data={expenseByCategory.filter(c => !hiddenCategories[c.name])}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={75}
                                            outerRadius={110}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {expenseByCategory.filter(c => !hiddenCategories[c.name]).map((entry, index) => {
                                                const originalIndex = expenseByCategory.findIndex(c => c.name === entry.name);
                                                return <Cell key={`cell-${index}`} fill={CHART_COLORS[originalIndex % CHART_COLORS.length]} />;
                                            })}
                                        </Pie>
                                        <RechartsTooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            
                            {/* Custom Checkbox Legend */}
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                                gap: '0.5rem', 
                                padding: '1rem',
                                background: 'rgba(0,0,0,0.02)',
                                borderRadius: '12px',
                                border: '1px solid var(--border)'
                            }}>
                                {expenseByCategory.map((entry, index) => {
                                    const color = CHART_COLORS[index % CHART_COLORS.length];
                                    const isHidden = hiddenCategories[entry.name];
                                    return (
                                        <label key={entry.name} style={{ 
                                            display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                            cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)',
                                            padding: '0.4rem', borderRadius: '8px',
                                            transition: 'all 0.2s ease',
                                            opacity: isHidden ? 0.5 : 1
                                        }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'} 
                                           onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                            <input 
                                                type="checkbox" 
                                                checked={!isHidden} 
                                                onChange={() => setHiddenCategories(prev => ({ ...prev, [entry.name]: !isHidden }))} 
                                                style={{ accentColor: color, width: '15px', height: '15px', cursor: 'pointer', margin: 0 }}
                                            />
                                            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: color, flexShrink: 0 }}></span>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontWeight: 500 }} title={entry.name}>
                                                {entry.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            No expenses recorded yet.
                        </div>
                    )}
                </div>
                    </div>
                    <div style={{ flex: '1 1 30%', minWidth: '320px', display: 'flex' }}>
                        {/* Custom Fund Distribution Flow */}
                <div className="glass-panel" style={{ width: "100%", padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Layers size={20} color="var(--primary)" />
                        Fund Distribution Pipeline
                    </h4>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative', padding: '1rem 0', justifyContent: 'flex-start' }}>
                        
                        {/* Funding Node */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 2 }}>
                            <div style={{ 
                                width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                                <Target size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>1. Total Allocation</span>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#10b981' }}>{formatCurrency(fundFlowData.totalFunding)}</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: '100%', height: '100%', background: '#10b981' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Connector */}
                        <div style={{ marginLeft: '23px', width: '2px', height: '24px', background: 'var(--border)' }}></div>

                        {/* Guide Node */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 2 }}>
                            <div style={{ 
                                width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)'
                            }}>
                                <Crown size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>2. To {fundFlowData.guideName}</span>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#6366f1' }}>{formatCurrency(fundFlowData.guideReceived)}</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(100, (fundFlowData.guideReceived / (fundFlowData.totalFunding || 1)) * 100)}%`, height: '100%', background: '#6366f1' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Connector */}
                        <div style={{ marginLeft: '23px', width: '2px', height: '24px', background: 'var(--border)' }}></div>

                        {/* Students Node */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 2 }}>
                            <div style={{ 
                                width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)'
                            }}>
                                <Users size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>3. To Sub-Cashiers (Students)</span>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f59e0b' }}>{formatCurrency(fundFlowData.studentReceived)}</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(100, (fundFlowData.studentReceived / (fundFlowData.totalFunding || 1)) * 100)}%`, height: '100%', background: '#f59e0b' }}></div>
                                </div>
                                
                                {fundFlowData.students && fundFlowData.students.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem', paddingLeft: '0.75rem', borderLeft: '2px solid rgba(245, 158, 11, 0.2)' }}>
                                        {fundFlowData.students.map(student => (
                                            <div key={student.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{student.name}</span>
                                                <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>{formatCurrency(student.received)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Connector */}
                        <div style={{ marginLeft: '23px', width: '2px', height: '24px', background: 'var(--border)' }}></div>

                        {/* Spent Node */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 2 }}>
                            <div style={{ 
                                width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                                <TrendingDown size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>4. Finally Spent (Vendors)</span>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#ef4444' }}>{formatCurrency(fundFlowData.totalSpent)}</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(100, (fundFlowData.totalSpent / (fundFlowData.totalFunding || 1)) * 100)}%`, height: '100%', background: '#ef4444' }}></div>
                                </div>
                            </div>
                        </div>

                    </div>
                    
                    {/* Summary Insights */}
                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '120px', background: 'rgba(99, 102, 241, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Sub-Cashier Holdings</span>
                            <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 800 }}>{formatCurrency(fundFlowData.studentReceived - fundFlowData.totalSpent)}</h4>
                        </div>
                        <div style={{ flex: 1, minWidth: '120px', background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Fund Burn Rate</span>
                            <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 800 }}>{((fundFlowData.totalSpent / (fundFlowData.totalFunding || 1)) * 100).toFixed(1)}%</h4>
                        </div>
                    </div>
                </div>
                    </div>
                    <div style={{ flex: '1 1 30%', minWidth: '320px', display: 'flex' }}>
                        {/* Payment Modes */}
                <div className="glass-panel" style={{ width: "100%", padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Wallet size={20} color="#ec4899" />
                        Payment Mode Distribution
                    </h4>
                    {paymentModes.length > 0 ? (
                        <div style={{ height: 320, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 320 }}>
                                <PieChart>
                                    <Pie
                                        data={paymentModes}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={75}
                                        outerRadius={110}
                                        dataKey="value"
                                    >
                                        {paymentModes.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 4) % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No payment modes</div>
                    )}
                    
                    {/* Payment Mode Summary */}
                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {paymentModes.slice(0, 3).map((mode, i) => (
                            <div key={mode.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: CHART_COLORS[(i + 4) % CHART_COLORS.length] }}></span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>{mode.name}</span>
                                </div>
                                <span style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 700 }}>{formatCurrency(mode.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                    </div>
                </div>

                {/* Row 2: Full Width */}
                <div style={{ width: '100%', display: 'flex' }}>
                    {/* Cumulative Burn Down / Up */}
                <div className="glass-panel" style={{ width: "100%", padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Activity size={20} color="var(--primary)" />
                        Cumulative Budget vs Spending
                    </h4>
                    {dailyData.length > 0 ? (
                        <div style={{ height: 350, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 350 }}>
                                <AreaChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} />
                                    <YAxis width={100} stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <ReferenceLine y={totalIncome} stroke="var(--success)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Total Allocation', fill: 'var(--success)' }} />
                                    <Area type="monotone" name="Cumulative Spent" dataKey="cumulativeExpense" stroke="var(--danger)" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            Not enough data to display timeline.
                        </div>
                    )}
                </div>
                </div>

                {/* Row 3: 2-Split */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '2 1 60%', minWidth: '400px', display: 'flex' }}>
                        {/* Daily Spending Velocity */}
                <div className="glass-panel" style={{ width: "100%", padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <BarChart3 size={20} color="var(--accent)" />
                        Daily Spending Velocity
                    </h4>
                    {dailyData.length > 0 ? (
                        <div style={{ height: 350, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 350 }}>
                                <BarChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} />
                                    <YAxis width={100} stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'var(--surface-hover)'}} />
                                    <Bar dataKey="expense" name="Daily Expense" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data available</div>
                    )}
                </div>
                    </div>
                    <div style={{ flex: '1 1 30%', minWidth: '320px', display: 'flex' }}>
                        {/* Top Vendors & Payees */}
                <div className="glass-panel" style={{ width: "100%", padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Truck size={20} color="#f59e0b" />
                        Top Payees / Vendors
                    </h4>
                    {topVendors.length > 0 ? (
                        <div style={{ height: 320, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 320 }}>
                                <BarChart data={topVendors} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                    <XAxis type="number" stroke="var(--text-muted)" tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                                    <YAxis type="category" dataKey="name" stroke="var(--text-muted)" width={130} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'var(--surface-hover)'}} />
                                    <Bar dataKey="value" name="Amount Paid" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                                        {topVendors.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No vendors recorded</div>
                    )}
                </div>
                    </div>
                </div>

                {/* Row 4: Full Width */}
                <div style={{ width: '100%', display: 'flex' }}>
                    {/* Cashier Leaderboard */}
                <div className="glass-panel" style={{ width: "100%", padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Users size={20} color="#14b8a6" />
                        Cashier Activity Volume
                    </h4>
                    {cashierLeaderboard.length > 0 ? (
                        <div style={{ height: 320, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 320 }}>
                                <BarChart data={cashierLeaderboard} margin={{ top: 10, right: 30, left: 0, bottom: 45 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--text-muted)" interval={0} angle={-35} textAnchor="end" height={60} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis width={100} stroke="var(--text-muted)" tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'var(--surface-hover)'}} />
                                    <Bar dataKey="value" name="Total Handled" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No cashier data</div>
                    )}
                </div>
                </div>

            </div>

            {/* PHASE-WISE ANALYTICS (Only at Project Level) */}
            {!phaseId && (
                <div style={{ marginTop: '1rem', borderTop: '2px dashed var(--border)', paddingTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <LayoutGrid color="var(--primary)" />
                        Phase-Wise Analytics & Deep Insights
                    </h3>
                    
                    {allPhases && allPhases.length > 0 && (
                        <div className="glass-panel" style={{ 
                            padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '0.5rem',
                            position: 'sticky', top: '20px', zIndex: 100, 
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>Global Phase Filter</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                        onClick={() => setHiddenPhases({})} 
                                        style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 500 }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        Select All
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const all = {};
                                            allPhases.forEach(p => all[p] = true);
                                            setHiddenPhases(all);
                                        }} 
                                        style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 500 }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {allPhases.map((ph, idx) => {
                                    const isHidden = hiddenPhases[ph];
                                    return (
                                        <label key={ph} style={{ 
                                            display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                            cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)',
                                            padding: '0.4rem 0.8rem', borderRadius: '20px', transition: 'all 0.2s ease',
                                            border: `1px solid ${isHidden ? 'var(--border)' : 'var(--primary)'}`,
                                            background: isHidden ? 'transparent' : 'rgba(99, 102, 241, 0.1)',
                                            opacity: isHidden ? 0.6 : 1
                                        }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = isHidden ? 0.6 : 1}>
                                            <input 
                                                type="checkbox" checked={!isHidden} 
                                                onChange={(e) => {
                                                    if (e.nativeEvent.shiftKey && lastClickedPhase) {
                                                        const startIdx = allPhases.indexOf(lastClickedPhase);
                                                        const endIdx = allPhases.indexOf(ph);
                                                        if (startIdx !== -1 && endIdx !== -1) {
                                                            const min = Math.min(startIdx, endIdx);
                                                            const max = Math.max(startIdx, endIdx);
                                                            const newHidden = { ...hiddenPhases };
                                                            const targetState = isHidden; 
                                                            for (let i = min; i <= max; i++) {
                                                                if (targetState) delete newHidden[allPhases[i]];
                                                                else newHidden[allPhases[i]] = true;
                                                            }
                                                            setHiddenPhases(newHidden);
                                                            setLastClickedPhase(ph);
                                                            return;
                                                        }
                                                    }
                                                    setHiddenPhases(prev => {
                                                        const next = { ...prev };
                                                        if (isHidden) delete next[ph];
                                                        else next[ph] = true;
                                                        return next;
                                                    });
                                                    setLastClickedPhase(ph);
                                                }} 
                                                style={{ accentColor: 'var(--primary)', width: '14px', height: '14px', cursor: 'pointer', margin: 0 }}
                                            />
                                            <span style={{ fontWeight: 500 }}>{ph}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* Net Cash Flow Timeline (Composed Chart) */}
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                <Activity size={20} color="var(--success)" />
                                Net Cash Flow Timeline (Income vs Expense)
                            </h4>
                            {netCashFlowData.length > 0 ? (
                                <div style={{ height: 350, width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 350 }}>
                                        <ComposedChart data={netCashFlowData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                            <XAxis dataKey="date" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} />
                                            <YAxis width={100} stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="income" name="Funding Received" barSize={20} fill="var(--success)" radius={[4, 4, 0, 0]} />
                                            <Area type="monotone" dataKey="expense" name="Daily Expense" fill="var(--danger)" stroke="var(--danger)" opacity={0.5} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No cash flow data</div>
                            )}
                        </div>

                        {/* Phase Budget vs Spend */}
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                <BarChart3 size={20} color="var(--primary)" />
                                Phase Budget vs. Spend
                            </h4>
                            {phaseComparisonData.length > 0 ? (
                                <div style={{ height: 350, width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 350 }}>
                                        <BarChart data={phaseComparisonData.filter(p => !hiddenPhases[p.name])} margin={{ top: 10, right: 30, left: 0, bottom: 45 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                            <XAxis dataKey="name" stroke="var(--text-muted)" interval={0} angle={-35} textAnchor="end" height={60} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                            <YAxis width={100} stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="received" name="Total Funding" fill="var(--success)" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="spent" name="Total Spent" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No phases to compare</div>
                            )}
                        </div>

                        {/* Category Spending by Phase */}
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                <Layers size={20} color="var(--accent)" />
                                Category Breakdown by Phase
                            </h4>
                            {categoryByPhaseData.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', width: '100%', alignItems: 'stretch' }}>
                                    <div style={{ height: 350, flex: 1, minWidth: 0 }}>
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 600, height: 350 }}>
                                            <BarChart data={categoryByPhaseData.filter(p => !hiddenPhases[p.name])} margin={{ top: 10, right: 30, left: 0, bottom: 45 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                                <XAxis dataKey="name" stroke="var(--text-muted)" interval={0} angle={-35} textAnchor="end" height={60} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <YAxis width={100} stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                                                <RechartsTooltip content={<CustomTooltip />} />
                                                {categoriesSet.map((cat, index) => {
                                                    if (hiddenCategories[cat]) return null;
                                                    return <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={CHART_COLORS[index % CHART_COLORS.length]} />;
                                                })}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{ 
                                        width: '200px', flexShrink: 0,
                                        display: 'flex', flexDirection: 'column', gap: '0.4rem', 
                                        padding: '1rem', background: 'rgba(0,0,0,0.02)',
                                        borderRadius: '12px', border: '1px solid var(--border)',
                                        maxHeight: '350px', overflowY: 'auto'
                                    }}>
                                        {categoriesSet.map((cat, index) => {
                                            const color = CHART_COLORS[index % CHART_COLORS.length];
                                            const isHidden = hiddenCategories[cat];
                                            return (
                                                <label key={cat} style={{ 
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                                    cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-main)',
                                                    padding: '0.3rem', borderRadius: '6px', transition: 'all 0.2s ease',
                                                    opacity: isHidden ? 0.5 : 1
                                                }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'} 
                                                   onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!isHidden} 
                                                        onChange={() => setHiddenCategories(prev => ({ ...prev, [cat]: !isHidden }))} 
                                                        style={{ accentColor: color, width: '14px', height: '14px', cursor: 'pointer', margin: 0 }}
                                                    />
                                                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: color, flexShrink: 0 }}></span>
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontWeight: 500 }} title={cat}>
                                                        {cat}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No categories to compare</div>
                            )}
                        </div>

                        {/* Spending Shape (Radar Chart) */}
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                <Target size={20} color="#f59e0b" />
                                Project Spending Profile
                            </h4>
                            {radarData.length > 0 ? (
                                <div style={{ height: 400, width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 400, height: 400 }}>
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                            <PolarGrid stroke="var(--border)" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-main)', fontSize: 12 }} />
                                            <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(val) => `₹${val}`} />
                                            <Radar name="Spent" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.5} />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data to profile</div>
                            )}
                        </div>

                    </div>
                </div>
            )}
            
        </div>
    );
}
