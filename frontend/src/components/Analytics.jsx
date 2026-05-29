import React, { useMemo, useState } from 'react';
import { useProjectData } from '../context/ProjectDataContext';
import { useFormatting } from '../context/SettingsContext';
import { 
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, ReferenceLine,
    ComposedChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Activity, DollarSign, PieChart as PieChartIcon, TrendingUp, TrendingDown, Target, FileText, Percent, Tag, Truck, Wallet, Users, BarChart3, Layers, LayoutGrid } from 'lucide-react';

const CHART_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#0ea5e9', '#84cc16', '#eab308'];

export default function Analytics({ projectId, projectName, phaseId }) {
    const { formatCurrency, formatDate } = useFormatting();
    const { journal, phaseFinances, projectFinances, loading } = useProjectData();
    const [hiddenCategories, setHiddenCategories] = useState({});

    // Use exact totals calculated by the context
    const totalIncome = phaseId ? (phaseFinances[phaseId]?.received || 0) : (projectFinances?.received || 0);
    const totalExpense = phaseId ? (phaseFinances[phaseId]?.spent || 0) : (projectFinances?.spent || 0);
    const balance = phaseId ? (phaseFinances[phaseId]?.balance || 0) : (projectFinances?.balance || 0);

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
    const { phaseComparisonData, categoryByPhaseData, netCashFlowData, radarData, categoriesSet } = useMemo(() => {
        if (phaseId) return { phaseComparisonData: [], categoryByPhaseData: [], netCashFlowData: [], radarData: [], categoriesSet: [] };

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

        const categoryByPhaseData = Object.values(phaseCategoryMap);
        const categories = Array.from(categorySet);
        
        const netCashFlowData = Object.values(cashFlowMap).sort((a,b) => a.timestamp - b.timestamp);
        
        const radarData = Object.entries(radarMap).map(([subject, A]) => ({ subject, A })).sort((a,b) => b.A - a.A).slice(0, 6); // Top 6 categories

        return { phaseComparisonData, categoryByPhaseData, netCashFlowData, radarData, categoriesSet: categories };
    }, [journal, phaseFinances, phaseId]);

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                
                {/* Expense Breakdown */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <PieChartIcon size={20} color="var(--danger)" />
                        Expense Breakdown
                    </h4>
                    {expenseByCategory.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                            <div style={{ height: 320, width: '100%' }}>
                                <ResponsiveContainer>
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

                {/* Daily Spending Velocity */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <BarChart3 size={20} color="var(--accent)" />
                        Daily Spending Velocity
                    </h4>
                    {dailyData.length > 0 ? (
                        <div style={{ height: 350, width: '100%' }}>
                            <ResponsiveContainer>
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

                {/* Top Vendors & Payees */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Truck size={20} color="#f59e0b" />
                        Top Payees / Vendors
                    </h4>
                    {topVendors.length > 0 ? (
                        <div style={{ height: 320, width: '100%' }}>
                            <ResponsiveContainer>
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

                {/* Cashier Leaderboard */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Users size={20} color="#14b8a6" />
                        Cashier Activity Volume
                    </h4>
                    {cashierLeaderboard.length > 0 ? (
                        <div style={{ height: 320, width: '100%' }}>
                            <ResponsiveContainer>
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

                {/* Payment Modes */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        <Wallet size={20} color="#ec4899" />
                        Payment Mode Distribution
                    </h4>
                    {paymentModes.length > 0 ? (
                        <div style={{ height: 320, width: '100%' }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={paymentModes}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={0}
                                        outerRadius={100}
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
                </div>

            </div>

            {/* PHASE-WISE ANALYTICS (Only at Project Level) */}
            {!phaseId && (
                <div style={{ marginTop: '1rem', borderTop: '2px dashed var(--border)', paddingTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <LayoutGrid color="var(--primary)" />
                        Phase-Wise Analytics & Deep Insights
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                        
                        {/* Net Cash Flow Timeline (Composed Chart) */}
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                <Activity size={20} color="var(--success)" />
                                Net Cash Flow Timeline (Income vs Expense)
                            </h4>
                            {netCashFlowData.length > 0 ? (
                                <div style={{ height: 350, width: '100%' }}>
                                    <ResponsiveContainer>
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
                                    <ResponsiveContainer>
                                        <BarChart data={phaseComparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 45 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                            <XAxis dataKey="name" stroke="var(--text-muted)" interval={0} angle={-35} textAnchor="end" height={60} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                            <YAxis width={100} stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend />
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                                    <div style={{ height: 350, width: '100%' }}>
                                        <ResponsiveContainer>
                                            <BarChart data={categoryByPhaseData} margin={{ top: 10, right: 30, left: 0, bottom: 45 }}>
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
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                        gap: '0.5rem', 
                                        padding: '1rem',
                                        background: 'rgba(0,0,0,0.02)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)'
                                    }}>
                                        {categoriesSet.map((cat, index) => {
                                            const color = CHART_COLORS[index % CHART_COLORS.length];
                                            const isHidden = hiddenCategories[cat];
                                            return (
                                                <label key={cat} style={{ 
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
                                                        onChange={() => setHiddenCategories(prev => ({ ...prev, [cat]: !isHidden }))} 
                                                        style={{ accentColor: color, width: '15px', height: '15px', cursor: 'pointer', margin: 0 }}
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
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                <Target size={20} color="#f59e0b" />
                                Project Spending Profile
                            </h4>
                            {radarData.length > 0 ? (
                                <div style={{ height: 400, width: '100%' }}>
                                    <ResponsiveContainer>
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
