import React, { useState, useEffect, useMemo } from 'react';
import { accountingApi } from '../services/api';
import { useFormatting } from '../context/SettingsContext';
import { 
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Activity, DollarSign, PieChart as PieChartIcon, TrendingUp, TrendingDown, Target } from 'lucide-react';

const COLORS = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe', '#f0f9ff', '#0369a1', '#075985', '#0c4a6e'];
const EXPENSE_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2', '#b91c1c', '#991b1b', '#7f1d1d'];
const INCOME_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#059669', '#047857', '#065f46'];

export default function Analytics({ projectId, projectName, phaseId }) {
    const { formatCurrency, formatDate } = useFormatting();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchJournal = async () => {
        setLoading(true);
        try {
            const data = await accountingApi.getJournal(projectId, phaseId);
            setTransactions(data);
        } catch (error) {
            console.error("Failed to fetch journal for analytics", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            fetchJournal();
        }
    }, [projectId, phaseId]);

    const { 
        totalIncome, 
        totalExpense, 
        balance,
        expenseByCategory,
        dailyData,
        incomeByCategory
    } = useMemo(() => {
        let tIncome = 0;
        let tExpense = 0;
        const expMap = {};
        const incMap = {};
        const dateMap = {};

        transactions.forEach(tx => {
            const isExpense = tx.lines?.some(l => l.account?.type === 'EXPENSE' || l.account?.type === 'ASSET' && l.type === 'CREDIT' && tx.lines?.some(l2 => l2.account?.type === 'EXPENSE'));
            const isIncome = tx.lines?.some(l => l.account?.type === 'INCOME' || l.account?.type === 'EQUITY' || l.account?.type === 'LIABILITY'); // Approximations for funding
            
            // Refine expense/income detection for student projects
            const amount = tx.lines?.[0]?.amount || 0;
            const primaryAccount = tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || 'Unknown';
            const incomeAccount = tx.lines?.find(l => l.type === 'CREDIT')?.account?.name || 'Unknown';

            // Actual expense logic based on your double entry system
            // Usually, debit to Expense account means expense
            const expenseLine = tx.lines?.find(l => l.account?.type === 'EXPENSE' && l.type === 'DEBIT');
            const incomeLine = tx.lines?.find(l => (l.account?.type === 'INCOME' || l.account?.type === 'EQUITY') && l.type === 'CREDIT');

            const dateStr = new Date(tx.date).toLocaleDateString();
            if (!dateMap[dateStr]) {
                dateMap[dateStr] = { date: dateStr, timestamp: new Date(tx.date).getTime(), income: 0, expense: 0 };
            }

            if (expenseLine) {
                tExpense += amount;
                expMap[expenseLine.account.name] = (expMap[expenseLine.account.name] || 0) + amount;
                dateMap[dateStr].expense += amount;
            } else if (incomeLine) {
                tIncome += amount;
                incMap[incomeLine.account.name] = (incMap[incomeLine.account.name] || 0) + amount;
                dateMap[dateStr].income += amount;
            } else {
                 // Fallback for custom entries: assume DEBIT to anything other than Asset is expense if CREDIT is Asset (Cash/Bank)
                 const creditAsset = tx.lines?.find(l => l.account?.type === 'ASSET' && l.type === 'CREDIT');
                 if (creditAsset) {
                     tExpense += amount;
                     expMap[primaryAccount] = (expMap[primaryAccount] || 0) + amount;
                     dateMap[dateStr].expense += amount;
                 } else {
                     const debitAsset = tx.lines?.find(l => l.account?.type === 'ASSET' && l.type === 'DEBIT');
                     if (debitAsset) {
                         tIncome += amount;
                         incMap[incomeAccount] = (incMap[incomeAccount] || 0) + amount;
                         dateMap[dateStr].income += amount;
                     }
                 }
            }
        });

        // Format for Recharts
        const expCategoryData = Object.entries(expMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        const incCategoryData = Object.entries(incMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        
        // Sort daily data and calculate cumulative
        const dailyArr = Object.values(dateMap).sort((a,b) => a.timestamp - b.timestamp);
        let cumIncome = 0;
        let cumExpense = 0;
        dailyArr.forEach(d => {
            cumIncome += d.income;
            cumExpense += d.expense;
            d.cumulativeIncome = cumIncome;
            d.cumulativeExpense = cumExpense;
        });

        return {
            totalIncome: tIncome,
            totalExpense: tExpense,
            balance: tIncome - tExpense,
            expenseByCategory: expCategoryData,
            incomeByCategory: incCategoryData,
            dailyData: dailyArr
        };
    }, [transactions]);

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
                        <div style={{ height: 300, width: '100%' }}>
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
                                            <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            No expenses recorded yet.
                        </div>
                    )}
                </div>

                {/* Income Breakdown */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <TrendingUp size={20} color="var(--success)" />
                        Funding Sources
                    </h4>
                    {incomeByCategory.length > 0 ? (
                        <div style={{ height: 300, width: '100%' }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={incomeByCategory}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {incomeByCategory.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            No funding sources recorded yet.
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
                                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                                        </linearGradient>
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
                                    <Area type="monotone" name="Total Funding" dataKey="cumulativeIncome" stroke="var(--success)" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                                    <Area type="monotone" name="Total Spent" dataKey="cumulativeExpense" stroke="var(--danger)" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
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
