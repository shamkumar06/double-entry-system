import React, { useMemo } from 'react';
import { useProjectData } from '../context/ProjectDataContext';
import { useFormatting } from '../context/SettingsContext';
import { 
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, ReferenceLine
} from 'recharts';
import { Activity, DollarSign, PieChart as PieChartIcon, TrendingUp, TrendingDown, Target } from 'lucide-react';

const CHART_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#0ea5e9', '#84cc16', '#eab308'];

export default function Analytics({ projectId, projectName, phaseId }) {
    const { formatCurrency, formatDate } = useFormatting();
    const { journal, phaseFinances, projectFinances, loading } = useProjectData();

    // Use exact totals calculated by the context
    const totalIncome = phaseId ? (phaseFinances[phaseId]?.received || 0) : (projectFinances?.received || 0);
    const totalExpense = phaseId ? (phaseFinances[phaseId]?.spent || 0) : (projectFinances?.spent || 0);
    const balance = phaseId ? (phaseFinances[phaseId]?.balance || 0) : (projectFinances?.balance || 0);

    const { 
        expenseByCategory,
        dailyData
    } = useMemo(() => {
        const activeJournal = phaseId ? journal.filter(tx => tx.phaseId === phaseId || tx.phase?.id === phaseId) : journal;
        let tExpense = 0;
        const expMap = {};
        const dateMap = {};

        activeJournal.forEach(tx => {
            const amount = Number(tx.lines?.[0]?.amount) || 0;
            const primaryAccount = tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || 'Unknown';
            const expenseLine = tx.lines?.find(l => l.account?.type === 'EXPENSE' && l.type === 'DEBIT');

            const dateStr = new Date(tx.date).toLocaleDateString();
            if (!dateMap[dateStr]) {
                dateMap[dateStr] = { date: dateStr, timestamp: new Date(tx.date).getTime(), expense: 0 };
            }

            if (expenseLine) {
                tExpense += amount;
                expMap[expenseLine.account.name] = (expMap[expenseLine.account.name] || 0) + amount;
                dateMap[dateStr].expense += amount;
            } else {
                 const creditAsset = tx.lines?.find(l => l.account?.type === 'ASSET' && l.type === 'CREDIT');
                 if (creditAsset) {
                     tExpense += amount;
                     expMap[primaryAccount] = (expMap[primaryAccount] || 0) + amount;
                     dateMap[dateStr].expense += amount;
                 }
            }
        });

        const expCategoryData = Object.entries(expMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        
        const dailyArr = Object.values(dateMap).sort((a,b) => a.timestamp - b.timestamp);
        let cumExpense = 0;
        dailyArr.forEach(d => {
            cumExpense += d.expense;
            d.cumulativeExpense = cumExpense;
        });

        return {
            expenseByCategory: expCategoryData,
            dailyData: dailyArr
        };
    }, [journal, phaseId]);

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                
                {/* Expense Breakdown */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <PieChartIcon size={20} color="var(--danger)" />
                        Expense Breakdown
                    </h4>
                    {expenseByCategory.length > 0 ? (
                        <div style={{ height: 380, width: '100%' }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={expenseByCategory}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {expenseByCategory.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            No expenses recorded yet.
                        </div>
                    )}
                </div>


                {/* Cumulative Burn Down / Up */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Activity size={20} color="var(--primary)" />
                        Cumulative Budget vs Spending
                    </h4>
                    {dailyData.length > 0 ? (
                        <div style={{ height: 350, width: '100%' }}>
                            <ResponsiveContainer>
                                <AreaChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} />
                                    <YAxis stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
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
        </div>
    );
}
