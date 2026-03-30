import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { Scale } from 'lucide-react';
import { useFormatting } from '../context/SettingsContext';

export default function TrialBalance({ projectId, projectName, phaseId }) {
    const { formatCurrency } = useFormatting();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [phases, setPhases] = useState([]);
    const [selectedPhaseId, setSelectedPhaseId] = useState(phaseId || null);

    const fetchTrialBalance = async () => {
        setLoading(true);
        try {
            const response = await accountingApi.getTrialBalance(projectId, selectedPhaseId);
            setData(response);
        } catch (error) {
            console.error("Failed to fetch trial balance", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Load project phases using logical ID
        accountingApi.listProjects().then(projs => {
            const p = projs.find(pj => pj.logical_id === projectId);
            if (p && p.phases) {
                setPhases(Object.values(p.phases));
            }
        });
    }, [projectId]);

    useEffect(() => {
        setSelectedPhaseId(phaseId || null);
    }, [phaseId]);

    useEffect(() => {
        fetchTrialBalance();
    }, [projectId, selectedPhaseId]);

    const togglePhase = (pid, e) => {
        const strPid = String(pid);
        if (e && e.shiftKey) {
            setSelectedPhaseId(prev => {
                if (!prev) return strPid;
                const arr = prev.split(',');
                if (arr.includes(strPid)) {
                    const newArr = arr.filter(p => p !== strPid);
                    return newArr.length > 0 ? newArr.join(',') : null;
                }
                return [...arr, strPid].join(',');
            });
        } else {
            setSelectedPhaseId(prev => (String(prev) === strPid ? null : strPid));
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Scale color="var(--primary)" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Trial Balance</h3>
                </div>
                {data && (
                    <div style={{ padding: '0.5rem 1rem', borderRadius: '9999px', background: data.totals.is_balanced ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: data.totals.is_balanced ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                        {data.totals.is_balanced ? 'BALANCED' : 'OUT OF BALANCE'}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {loading ? (
                        <p style={{ color: 'var(--text-muted)' }}>Loading balances...</p>
                    ) : !data || Object.keys(data.accounts).length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No accounts found.</p>
                    ) : (
                        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Account Name</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>Debit Balance</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>Credit Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(data.accounts).map(([accountName, accountData]) => {
                                        const netBalance = accountData.balance; 
                                        const debitSide = netBalance >= 0 ? netBalance : null;
                                        const creditSide = netBalance < 0 ? Math.abs(netBalance) : null;
                                        
                                        if(netBalance === 0) return null;
                                        
                                        return (
                                            <tr key={accountName} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem', fontWeight: 500 }}>{accountName}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    {debitSide !== null ? formatCurrency(debitSide) : '-'}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    {creditSide !== null ? formatCurrency(creditSide) : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                                        <td style={{ padding: '1.5rem 1rem 1rem 1rem' }}>Total</td>
                                        <td style={{ padding: '1.5rem 1rem 1rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>
                                            {formatCurrency(data.totals.total_debits)}
                                        </td>
                                        <td style={{ padding: '1.5rem 1rem 1rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>
                                            {formatCurrency(data.totals.total_credits)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                <div style={{ width: '120px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
                        Phase Filter
                    </span>
                    <button 
                        onClick={() => setSelectedPhaseId(null)}
                        style={{ 
                            padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer',
                            textAlign: 'center', fontWeight: !selectedPhaseId ? 600 : 400,
                            background: !selectedPhaseId ? 'var(--primary)' : 'var(--surface)',
                            color: !selectedPhaseId ? '#fff' : 'var(--text-main)',
                            border: '1px solid ' + (!selectedPhaseId ? 'var(--primary)' : 'var(--border)'),
                            transition: 'all 0.2s'
                        }}
                    >
                        Whole Project
                    </button>
                    {phases.map(ph => {
                        const isSelected = selectedPhaseId && selectedPhaseId.split(',').includes(String(ph.phase_id));
                        return (
                            <button 
                                key={ph.phase_id}
                                onClick={(e) => togglePhase(ph.phase_id, e)}
                                style={{ 
                                    padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer',
                                    textAlign: 'center', fontWeight: isSelected ? 600 : 400,
                                    background: isSelected ? 'var(--secondary)' : 'var(--surface)',
                                    color: isSelected ? '#fff' : 'var(--text-main)',
                                    border: '1px solid ' + (isSelected ? 'var(--secondary)' : 'var(--border)'),
                                    transition: 'all 0.2s'
                                }}
                            >
                                {ph.name}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
