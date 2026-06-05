import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, Handle, Position, Panel, addEdge as rfAddEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useProjectData } from '../context/ProjectDataContext';
import { Activity, Target, Truck, Users, Crown, Banknote, AlertCircle, Info, ChevronRight, ChevronLeft, ChevronDown, PieChart, ArrowRight, X, Zap, Repeat } from 'lucide-react';

// === HELPER FUNCTIONS ===
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

// === CUSTOM NODES ===

const NodeWrapper = ({ children, color, title, icon: Icon, amount, balance, role, selected, showBalance = true }) => (
    <div style={{
        background: 'var(--surface)',
        border: `2px solid ${selected ? color : 'var(--border)'}`,
        borderRadius: '12px',
        padding: '1rem',
        minWidth: '220px',
        boxShadow: selected ? `0 0 15px ${color}40` : '0 4px 6px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        opacity: 0.95
    }}>
        <Handle type="target" position={Position.Top} style={{ background: color, border: '2px solid var(--surface)', width: '10px', height: '10px', cursor: 'crosshair' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}20`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} />
            </div>
            <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={title}>{title}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{role}</p>
            </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Received:</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{formatCurrency(amount)}</span>
            </div>
            {showBalance && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Balance:</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: balance > 0 ? '#10b981' : 'var(--text-muted)' }}>{formatCurrency(balance || 0)}</span>
                </div>
            )}
        </div>
        <Handle type="source" position={Position.Bottom} style={{ background: color, border: '2px solid var(--surface)', width: '10px', height: '10px', cursor: 'crosshair' }} />
    </div>
);

const RootNode = ({ data, selected }) => <NodeWrapper {...data} icon={Banknote} color="#10b981" role="Funding Source" selected={selected} showBalance={true} />;
const GuideNode = ({ data, selected }) => <NodeWrapper {...data} icon={Crown} color="#3b82f6" role="Main Cashier" selected={selected} showBalance={true} />;
const SubCashierNode = ({ data, selected }) => <NodeWrapper {...data} icon={Users} color="#14b8a6" role="Sub-Cashier" selected={selected} showBalance={true} />;
const ProcuringNode = ({ data, selected }) => <NodeWrapper {...data} icon={Users} color="#f59e0b" role="Procuring Student" selected={selected} showBalance={true} />;
const VendorNode = ({ data, selected }) => <NodeWrapper {...data} icon={Truck} color="#ef4444" role="Vendor" selected={selected} showBalance={false} />;
const ExternalSourceNode = ({ data, selected }) => <NodeWrapper {...data} icon={Activity} color="#8b5cf6" role="External Source" selected={selected} showBalance={false} />;

const nodeTypes = {
    root: RootNode,
    guide: GuideNode,
    sub_cashier: SubCashierNode,
    procuring_student: ProcuringNode,
    vendor: VendorNode,
    external_source: ExternalSourceNode
};

// === DAGRE LAYOUT ===
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes, edges) => {
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 250, height: 120 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - 250 / 2,
                y: nodeWithPosition.y - 120 / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

// === TRANSFER MODAL ===
// === TRANSFER MODAL ===
const TransferModal = ({ sourceNode, targetNode, onConfirm, onCancel }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isReversed, setIsReversed] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const sender = isReversed ? targetNode : sourceNode;
    const receiver = isReversed ? sourceNode : targetNode;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) return;
        onConfirm({ 
            amount: Number(amount), 
            description: description || `Transfer from ${sender.data.title} to ${receiver.data.title}`,
            isReversed
        });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onCancel}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--surface)', borderRadius: '20px',
                padding: '2rem', width: '420px', maxWidth: '90vw',
                border: '1px solid var(--border)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
                animation: 'slideUp 0.3s ease-out'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={18} color="#10b981" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Quick Transfer</h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drag-to-connect transfer</p>
                        </div>
                    </div>
                    <button onClick={onCancel} style={{
                        background: 'var(--surface-hover)', border: 'none', borderRadius: '8px',
                        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-muted)'
                    }}><X size={16} /></button>
                </div>

                {/* Flow Visualization */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
                    padding: '1.25rem 1rem', borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08))',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: sender.type === 'root' ? 'rgba(16, 185, 129, 0.2)' : 
                                        sender.type === 'external_source' ? 'rgba(139, 92, 246, 0.2)' : 
                                        (sender.role === 'GUIDE' ? 'rgba(59, 130, 246, 0.2)' : 
                                        (sender.role === 'STUDENT' ? 'rgba(20, 184, 166, 0.2)' : 'rgba(245, 158, 11, 0.2)')),
                            color: sender.type === 'root' ? '#10b981' : 
                                   sender.type === 'external_source' ? '#8b5cf6' : 
                                   (sender.role === 'GUIDE' ? '#3b82f6' : 
                                   (sender.role === 'STUDENT' ? '#14b8a6' : '#f59e0b')),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 0.4rem', fontWeight: 800, fontSize: '0.85rem'
                        }}>{sender.data.title.charAt(0)}</div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sender.data.title}>{sender.data.title}</p>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{sender.type.replace('_', ' ')}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <button 
                            type="button"
                            onClick={() => setIsReversed(prev => !prev)}
                            title="Swap Transfer Direction"
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--primary)',
                                transition: 'all 0.25s ease',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'scale(1.1) rotate(180deg)';
                                e.currentTarget.style.borderColor = 'var(--primary)';
                                e.currentTarget.style.background = 'var(--surface-hover)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.background = 'var(--surface)';
                            }}
                        >
                            <Repeat size={14} />
                        </button>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Swap</span>
                    </div>

                    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: receiver.type === 'root' ? 'rgba(16, 185, 129, 0.2)' : 
                                        receiver.type === 'external_source' ? 'rgba(139, 92, 246, 0.2)' : 
                                        (receiver.role === 'GUIDE' ? 'rgba(59, 130, 246, 0.2)' : 
                                        (receiver.role === 'STUDENT' ? 'rgba(20, 184, 166, 0.2)' : 'rgba(245, 158, 11, 0.2)')),
                            color: receiver.type === 'root' ? '#10b981' : 
                                   receiver.type === 'external_source' ? '#8b5cf6' : 
                                   (receiver.role === 'GUIDE' ? '#3b82f6' : 
                                   (receiver.role === 'STUDENT' ? '#14b8a6' : '#f59e0b')),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 0.4rem', fontWeight: 800, fontSize: '0.85rem'
                        }}>{receiver.data.title.charAt(0)}</div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={receiver.data.title}>{receiver.data.title}</p>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{receiver.type.replace('_', ' ')}</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', display: 'block' }}>
                            Amount (₹)
                        </label>
                        <input
                            ref={inputRef}
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="Enter transfer amount"
                            required
                            style={{
                                width: '100%', padding: '0.9rem 1rem',
                                borderRadius: '12px', border: '1px solid var(--border)',
                                background: 'var(--background)', color: 'var(--primary)',
                                fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em',
                                outline: 'none', fontFamily: 'inherit',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', display: 'block' }}>
                            Description (optional)
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={`Fund transfer to ${receiver.data.title}`}
                            style={{
                                width: '100%', padding: '0.7rem 1rem',
                                borderRadius: '12px', border: '1px solid var(--border)',
                                background: 'var(--background)', color: 'var(--text-main)',
                                fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    <button type="submit" disabled={!amount || Number(amount) <= 0} style={{
                        padding: '0.9rem', borderRadius: '12px', border: 'none',
                        background: (!amount || Number(amount) <= 0) ? 'var(--surface-hover)' : 'linear-gradient(135deg, #10b981, #059669)',
                        color: (!amount || Number(amount) <= 0) ? 'var(--text-muted)' : '#fff',
                        fontSize: '0.95rem', fontWeight: 700, cursor: (!amount || Number(amount) <= 0) ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'all 0.2s',
                        boxShadow: (amount && Number(amount) > 0) ? '0 4px 15px rgba(16, 185, 129, 0.3)' : 'none'
                    }}>
                        <Zap size={16} />
                        Transfer {amount ? formatCurrency(Number(amount)) : '₹0'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// === MAIN COMPONENT ===

export default function FinancialMindMap({ onTransferRequest }) {
    const { project, journal, members, projectFinances, cashierFinances, phaseFinances } = useProjectData();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [dashboardStats, setDashboardStats] = useState({});
    const [transferModal, setTransferModal] = useState(null); // { sourceNode, targetNode }
    const [isPanelMinimized, setIsPanelMinimized] = useState(true);
    const [layoutTrigger, setLayoutTrigger] = useState(0);
    const [selectedPhaseId, setSelectedPhaseId] = useState('');

    const activeCashierFinances = useMemo(() => {
        const filteredJournal = selectedPhaseId 
            ? journal.filter(tx => tx.phaseId === selectedPhaseId || tx.phase?.id === selectedPhaseId)
            : journal;
            
        const finances = {};
        (members || []).forEach(m => {
            finances[m.name] = { name: m.name, received: 0, spent: 0, holding: 0 };
        });

        filteredJournal.forEach(tx => {
            (tx.lines || []).forEach(line => {
                const acctName = line.account?.name;
                const acctType = line.account?.type;
                const amt = Number(line.amount) || 0;
                const isMember = members.some(m => m.name === acctName);
                
                if (acctType === 'ASSET' && isMember) {
                    if (!finances[acctName]) {
                        finances[acctName] = { name: acctName, received: 0, spent: 0, holding: 0 };
                    }
                    if (line.type === 'DEBIT') {
                        finances[acctName].received += amt;
                        finances[acctName].holding += amt;
                    } else if (line.type === 'CREDIT') {
                        finances[acctName].spent += amt;
                        finances[acctName].holding -= amt;
                    }
                }
            });
        });
        return finances;
    }, [journal, members, selectedPhaseId]);

    // Graph Generation Logic
    // Graph Generation Logic
    useEffect(() => {
        if (!journal || !members || !activeCashierFinances) return;

        const filteredJournal = selectedPhaseId 
            ? journal.filter(tx => tx.phaseId === selectedPhaseId || tx.phase?.id === selectedPhaseId)
            : journal;

        const nodesMap = new Map();
        const edgesMap = new Map();

        const addNode = (id, title, type, exactAmount = null, balance = 0) => {
            if (!nodesMap.has(id)) {
                nodesMap.set(id, { id, type, data: { title, amount: exactAmount || 0, balance } });
            } else {
                if (exactAmount !== null) nodesMap.get(id).data.amount = exactAmount;
                if (balance !== 0) nodesMap.get(id).data.balance = balance;
            }
        };

        const addEdge = (source, target, amount) => {
            const edgeId = `${source}->${target}`;
            if (!edgesMap.has(edgeId)) {
                edgesMap.set(edgeId, {
                    id: edgeId,
                    source,
                    target,
                    type: 'smoothstep',
                    animated: true,
                    data: { amount: 0, count: 0 },
                    style: { stroke: 'var(--border)', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' }
                });
            }
            const edge = edgesMap.get(edgeId);
            if (edge.data.isStructural) {
                edge.animated = true;
                edge.style = { stroke: 'var(--border)', strokeWidth: 2 };
                edge.data.isStructural = false;
            }
            edge.data.amount += amount;
            edge.data.count += 1;
        };

        // Seed all active members reliably from Context
        let rootReceived = 0;
        let rootBalance = 0;
        if (selectedPhaseId) {
            const pf = phaseFinances[selectedPhaseId] || { received: 0, balance: 0 };
            rootReceived = pf.received;
            rootBalance = pf.balance;
        } else {
            rootReceived = projectFinances?.received || 0;
            rootBalance = projectFinances?.balance || 0;
        }

        addNode('ROOT', 'Main Cash Account', 'root', rootReceived, rootBalance);
        
        (members || []).forEach(m => {
            if (m.isActive === false) return;
            const cf = activeCashierFinances[m.name] || { received: 0, holding: 0 };
            let role = 'sub_cashier';
            if (m.role === 'GUIDE') role = 'guide';
            else if (m.role === 'PROCURING_STUDENT') role = 'procuring_student';
            
            addNode(m.name, m.name, role, cf.received, cf.holding);
        });

        // Add fallback for cashiers with transactions who are not active members
        Object.values(activeCashierFinances).forEach(cf => {
            if (!nodesMap.has(cf.name)) {
                const m = members.find(mem => mem.name === cf.name);
                let role = 'sub_cashier';
                if (m?.role === 'GUIDE') role = 'guide';
                else if (m?.role === 'PROCURING_STUDENT') role = 'procuring_student';
                addNode(cf.name, cf.name, role, cf.received, cf.holding);
            }
        });

        // Seed structural edges for assigned procuring students (if they don't have transaction edges yet)
        (members || []).forEach(m => {
            if (m.isActive === false || !m.parentMemberId) return;
            const parent = members.find(p => p.id === m.parentMemberId);
            if (parent) {
                const edgeId = `${parent.name}->${m.name}`;
                if (!edgesMap.has(edgeId)) {
                    edgesMap.set(edgeId, {
                        id: edgeId,
                        source: parent.name,
                        target: m.name,
                        type: 'smoothstep',
                        animated: false,
                        data: { amount: 0, count: 0, isStructural: true },
                        style: { stroke: 'var(--border)', strokeWidth: 1.5, strokeDasharray: '5,5', opacity: 0.6 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)' }
                    });
                }
            }
        });

        let totalDistributed = 0;
        let totalVendors = new Set();
        let pendingCount = 0;

        filteredJournal.forEach(tx => {
            const cashierCredits = [];
            const cashierDebits = [];
            let mainCashCredit = 0;
            let mainCashDebit = 0;
            const externalCredits = [];
            const externalDebits = [];
            const expenseDebits = [];

            (tx.lines || []).forEach(line => {
                const amt = Number(line.amount) || 0;
                const acctName = line.account?.name;
                const acctType = line.account?.type;
                
                const isMember = members.some(m => m.name === acctName);
                
                if (acctType === 'ASSET') {
                    if (isMember) {
                        if (line.type === 'CREDIT') cashierCredits.push({ name: acctName, amount: amt });
                        if (line.type === 'DEBIT') cashierDebits.push({ name: acctName, amount: amt });
                    } else if (acctName && (acctName.toLowerCase().includes('cash') || acctName.toLowerCase().includes('bank'))) {
                        if (line.type === 'CREDIT') mainCashCredit += amt;
                        if (line.type === 'DEBIT') mainCashDebit += amt;
                    } else if (acctName) {
                        if (line.type === 'CREDIT') externalCredits.push({ name: acctName, amount: amt, type: acctType });
                        if (line.type === 'DEBIT') externalDebits.push({ name: acctName, amount: amt, type: acctType });
                    }
                } else if (acctName && ['LIABILITY', 'REVENUE', 'INCOME', 'EQUITY'].includes(acctType)) {
                    if (line.type === 'CREDIT') externalCredits.push({ name: acctName, amount: amt, type: acctType });
                    if (line.type === 'DEBIT') externalDebits.push({ name: acctName, amount: amt, type: acctType });
                } else if (acctType === 'EXPENSE') {
                    if (line.type === 'DEBIT') expenseDebits.push({ name: acctName, amount: amt });
                }
            });

            // Flow Mapping:
            
            // 1. Cashier Debits (Cashier receives money)
            if (cashierDebits.length > 0) {
                if (cashierCredits.length > 0) {
                    // Internal Transfer between cashiers
                    cashierCredits.forEach(c => {
                        cashierDebits.forEach(d => {
                            const amount = Math.min(c.amount, d.amount);
                            addEdge(c.name, d.name, amount);
                        });
                    });
                } else if (mainCashCredit > 0) {
                    // Transfer from Main Cash/Bank to Cashier
                    cashierDebits.forEach(d => {
                        addEdge('ROOT', d.name, d.amount);
                        totalDistributed += d.amount;
                    });
                } else if (externalCredits.length > 0) {
                    // Collected from external source (Liability/Loan/Revenue)
                    externalCredits.forEach(ext => {
                        cashierDebits.forEach(d => {
                            const amount = Math.min(ext.amount, d.amount);
                            const extId = `EXT_${ext.name}`;
                            if (!nodesMap.has(extId)) {
                                addNode(extId, ext.name, 'external_source', amount, 0);
                            } else {
                                nodesMap.get(extId).data.amount += amount;
                            }
                            addEdge(extId, d.name, amount);
                        });
                    });
                }
            }

            // 2. Main Cash Debits (Main Cash receives money)
            if (mainCashDebit > 0) {
                if (cashierCredits.length > 0) {
                    // Deposit from Cashier to Main Cash/Bank
                    cashierCredits.forEach(c => {
                        addEdge(c.name, 'ROOT', c.amount);
                    });
                } else if (externalCredits.length > 0) {
                    // Deposit directly from external source (e.g. Sponsor/Loan to main cash/bank)
                    externalCredits.forEach(ext => {
                        const extId = `EXT_${ext.name}`;
                        const amount = ext.amount;
                        if (!nodesMap.has(extId)) {
                            addNode(extId, ext.name, 'external_source', amount, 0);
                        } else {
                            nodesMap.get(extId).data.amount += amount;
                        }
                        addEdge(extId, 'ROOT', amount);
                    });
                }
            }

            // 3. Expense/Vendor Payments
            if (expenseDebits.length > 0) {
                const vendorName = tx.toEntity || 'Unknown Vendor';
                const vendorId = `VENDOR_${vendorName}`;
                const amount = expenseDebits.reduce((sum, e) => sum + e.amount, 0);
                
                if (cashierCredits.length > 0) {
                    // Paid by Cashier
                    if (!nodesMap.has(vendorId)) {
                        addNode(vendorId, vendorName, 'vendor', amount, 0);
                    } else {
                        nodesMap.get(vendorId).data.amount += amount;
                    }
                    cashierCredits.forEach(c => {
                        addEdge(c.name, vendorId, Math.min(c.amount, amount));
                    });
                    totalVendors.add(vendorName);
                } else if (mainCashCredit > 0) {
                    // Paid directly from Main Cash/Bank
                    if (!nodesMap.has(vendorId)) {
                        addNode(vendorId, vendorName, 'vendor', amount, 0);
                    } else {
                        nodesMap.get(vendorId).data.amount += amount;
                    }
                    addEdge('ROOT', vendorId, amount);
                    totalVendors.add(vendorName);
                }
            }

            // 4. External Debits (Paying off liabilities or paying external entities)
            if (externalDebits.length > 0) {
                externalDebits.forEach(ext => {
                    const extId = `EXT_${ext.name}`;
                    const amount = ext.amount;
                    
                    if (cashierCredits.length > 0) {
                        // Paid off by cashier
                        if (!nodesMap.has(extId)) {
                            addNode(extId, ext.name, 'external_source', amount, 0);
                        } else {
                            nodesMap.get(extId).data.amount += amount;
                        }
                        cashierCredits.forEach(c => {
                            addEdge(c.name, extId, Math.min(c.amount, amount));
                        });
                    } else if (mainCashCredit > 0) {
                        // Paid off directly from Main Cash/Bank
                        if (!nodesMap.has(extId)) {
                            addNode(extId, ext.name, 'external_source', amount, 0);
                        } else {
                            nodesMap.get(extId).data.amount += amount;
                        }
                        addEdge('ROOT', extId, amount);
                    }
                });
            }

            if (tx.status === 'PENDING') pendingCount++;
        });

        // Refine node types (Sub-cashier vs Procuring)
        Array.from(edgesMap.values()).forEach(edge => {
            const sourceNode = nodesMap.get(edge.source);
            const targetNode = nodesMap.get(edge.target);
            
            // Prioritize database roles for active members
            const sourceMember = (members || []).find(m => m.name === sourceNode?.id);
            if (sourceMember) return;
            
            if (sourceNode?.type === 'student' || sourceNode?.type === 'sub_cashier' || sourceNode?.type === 'procuring_student') {
                if (targetNode?.type === 'student' || targetNode?.type === 'guide' || targetNode?.type === 'sub_cashier') {
                    sourceNode.type = 'sub_cashier';
                }
                if (targetNode?.type === 'vendor') {
                    if (sourceNode.type !== 'sub_cashier') sourceNode.type = 'procuring_student';
                }
            }
        });

        // Add edge labels
        Array.from(edgesMap.values()).forEach(edge => {
            if (edge.data.isStructural) {
                edge.label = 'Assigned';
                edge.labelStyle = { fill: 'var(--text-muted)', fontWeight: 600, fontSize: 10 };
                edge.labelBgStyle = { fill: 'var(--surface)', fillOpacity: 0.8 };
            } else {
                edge.label = formatCurrency(edge.data.amount);
                edge.labelStyle = { fill: 'var(--text-main)', fontWeight: 700, fontSize: 12 };
                edge.labelBgStyle = { fill: 'var(--surface)', fillOpacity: 0.8 };
            }
        });

        const initialNodes = Array.from(nodesMap.values());
        const initialEdges = Array.from(edgesMap.values());

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);

        // Retrieve and apply saved positions
        const savedPositionsKey = `mindmap-node-positions-${project?.id || 'default'}`;
        let savedPositions = {};
        try {
            const saved = localStorage.getItem(savedPositionsKey);
            if (saved) savedPositions = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to load saved mindmap positions", e);
        }

        const nodesWithSavedPositions = layoutedNodes.map(node => {
            if (savedPositions[node.id]) {
                return {
                    ...node,
                    position: savedPositions[node.id]
                };
            }
            return node;
        });

        setNodes(nodesWithSavedPositions);
        setEdges(layoutedEdges);
        
        setDashboardStats({
            totalDistributed,
            vendorCount: totalVendors.size,
            pendingCount
        });

    }, [journal, members, project, layoutTrigger, selectedPhaseId, activeCashierFinances, phaseFinances, projectFinances]);

    // Handle drag-to-connect between nodes
    const onConnect = useCallback((params) => {
        const sourceNode = nodes.find(n => n.id === params.source);
        const targetNode = nodes.find(n => n.id === params.target);
        
        if (sourceNode && targetNode) {
            setTransferModal({ sourceNode, targetNode });
        }
    }, [nodes]);

    const handleTransferConfirm = useCallback(({ amount, description, isReversed }) => {
        if (!transferModal || !onTransferRequest) return;
        
        const { sourceNode, targetNode } = transferModal;
        const actualSource = isReversed ? targetNode : sourceNode;
        const actualTarget = isReversed ? sourceNode : targetNode;
        
        onTransferRequest({
            sourceId: actualSource.id,
            sourceName: actualSource.data.title,
            sourceType: actualSource.type,
            targetId: actualTarget.id,
            targetName: actualTarget.data.title,
            targetType: actualTarget.type,
            amount,
            description
        });
        
        setTransferModal(null);
    }, [transferModal, onTransferRequest]);

    const onNodeDragStop = useCallback(() => {
        const savedPositionsKey = `mindmap-node-positions-${project?.id || 'default'}`;
        const positions = {};
        nodes.forEach(n => {
            positions[n.id] = n.position;
        });
        localStorage.setItem(savedPositionsKey, JSON.stringify(positions));
    }, [project, nodes]);

    const handleResetLayout = useCallback(() => {
        const savedPositionsKey = `mindmap-node-positions-${project?.id || 'default'}`;
        localStorage.removeItem(savedPositionsKey);
        setSelectedNode(null);
        setLayoutTrigger(prev => prev + 1);
    }, [project]);

    const onNodeClick = (event, node) => {
        setSelectedNode(node);
        
        // Trace mode: highlight edges
        setEdges((eds) => eds.map(e => {
            if (e.source === node.id || e.target === node.id) {
                e.style = { ...e.style, stroke: 'var(--primary)', strokeWidth: 4 };
                e.animated = true;
            } else {
                e.style = { ...e.style, stroke: 'var(--border)', strokeWidth: 2, opacity: 0.2 };
                e.animated = false;
            }
            return e;
        }));
        
        setNodes((nds) => nds.map(n => {
            if (n.id === node.id) n.data = { ...n.data, selected: true };
            else n.data = { ...n.data, selected: false };
            return n;
        }));
    };

    const onPaneClick = () => {
        setSelectedNode(null);
        setEdges((eds) => eds.map(e => {
            e.style = { ...e.style, stroke: 'var(--border)', strokeWidth: 2, opacity: 1 };
            e.animated = true;
            return e;
        }));
        setNodes((nds) => nds.map(n => {
            n.data = { ...n.data, selected: false };
            return n;
        }));
    };

    // Compute transactions for selected node
    const selectedNodeTransactions = useMemo(() => {
        if (!selectedNode) return [];
        const name = selectedNode.id;
        
        let txs = journal || [];
        if (selectedPhaseId) {
            txs = txs.filter(tx => tx.phaseId === selectedPhaseId || tx.phase?.id === selectedPhaseId);
        }

        if (name === 'ROOT') {
            return txs.filter(tx => 
                tx.lines?.some(l => l.account?.name === 'Main Cash Account')
            ).slice(0, 10);
        }
        if (selectedNode.type === 'vendor') {
            const vendorName = name.replace('VENDOR_', '');
            return txs.filter(tx => 
                tx.toEntity === vendorName
            ).slice(0, 10);
        }
        if (selectedNode.type === 'external_source') {
            const extName = name.replace('EXT_', '');
            return txs.filter(tx => 
                tx.lines?.some(l => l.account?.name === extName)
            ).slice(0, 10);
        }
        return txs.filter(tx => 
            tx.cashierName === name || tx.lines?.some(l => l.account?.name === name)
        ).slice(0, 10);
    }, [selectedNode, journal, selectedPhaseId]);

    return (
        <div style={{ width: '100%', height: '800px', background: 'var(--background)', borderRadius: '16px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', display: 'flex' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-left"
                minZoom={0.2}
            >
                <Background color="var(--border)" gap={20} size={1} />
                <Controls style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 100 }} />
                
                {isPanelMinimized ? (
                    <Panel position="top-left" style={{ margin: '1rem', zIndex: 100 }}>
                        <button onClick={() => setIsPanelMinimized(false)} className="glass-panel" style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '12px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--text-main)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            transition: 'all 0.2s',
                        }}>
                            <Activity size={16} color="var(--primary)" />
                            Show Map Info
                        </button>
                    </Panel>
                ) : (
                    <Panel position="top-left" style={{ margin: '1rem', zIndex: 100 }}>
                        <div className="glass-panel" style={{ padding: '1.5rem', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                            <button onClick={() => setIsPanelMinimized(true)} style={{
                                position: 'absolute',
                                top: '1.25rem',
                                right: '1.25rem',
                                background: 'var(--surface-hover)',
                                border: 'none',
                                borderRadius: '6px',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                transition: 'all 0.15s ease'
                            }} title="Minimize Panel">
                                <ChevronLeft size={14} />
                            </button>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Activity color="var(--primary)" size={20} />
                                        Financial Intelligence
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interactive Graph Topology</p>
                                </div>
                                <button 
                                    onClick={handleResetLayout}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '8px',
                                        background: 'var(--surface-hover)',
                                        border: '1px solid var(--border)',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                    <Repeat size={12} />
                                    Reset
                                </button>
                            </div>

                            {/* Phase filter dropdown select */}
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                                    📁 Select Phase View
                                </label>
                                <select 
                                    value={selectedPhaseId} 
                                    onChange={e => setSelectedPhaseId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 0.8rem',
                                        borderRadius: '10px',
                                        background: 'var(--surface-hover)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                >
                                    <option value="">📁 All Phases (Whole Project)</option>
                                    {project?.phases?.map(ph => (
                                        <option key={ph.id} value={ph.id}>
                                            {ph.isSettled ? '✅ ' : '⏳ '}{ph.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Total Distributed</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#3b82f6' }}>{formatCurrency(dashboardStats.totalDistributed)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Unique Vendors</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444' }}>{dashboardStats.vendorCount}</span>
                                </div>
                            </div>

                            {/* Drag hint */}
                            <div style={{
                                padding: '0.6rem 0.75rem', borderRadius: '8px',
                                background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)',
                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}>
                                <Zap size={14} color="#10b981" />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <b style={{ color: '#10b981' }}>Drag</b> between node handles to transfer funds
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '10px', background: '#3b82f620', color: '#3b82f6' }}>Guide</span>
                                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '10px', background: '#14b8a620', color: '#14b8a6' }}>Sub-Cashier</span>
                                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '10px', background: '#f59e0b20', color: '#f59e0b' }}>Procuring</span>
                                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '10px', background: '#ef444420', color: '#ef4444' }}>Vendor</span>
                                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '10px', background: '#8b5cf620', color: '#8b5cf6' }}>External</span>
                            </div>
                        </div>
                    </Panel>
                )}

                {selectedNode && (() => {
                    const name = selectedNode.id;
                    let received = 0;
                    let spent = 0;
                    let balance = 0;
                    let showStats = true;

                    if (name === 'ROOT') {
                        if (selectedPhaseId) {
                            const pf = phaseFinances[selectedPhaseId] || { received: 0, spent: 0, balance: 0 };
                            received = pf.received;
                            spent = pf.spent;
                            balance = pf.balance;
                        } else {
                            received = projectFinances?.received || 0;
                            spent = projectFinances?.spent || 0;
                            balance = projectFinances?.balance || 0;
                        }
                    } else if (selectedNode.type === 'vendor' || selectedNode.type === 'external_source') {
                        showStats = false;
                        spent = selectedNode.data.amount;
                    } else {
                        const cf = activeCashierFinances[name] || { received: 0, spent: 0, holding: 0 };
                        received = cf.received;
                        spent = cf.spent;
                        balance = cf.holding;
                    }

                    return (
                        <Panel position="top-right" style={{ margin: '1rem', width: '380px', zIndex: 100, maxHeight: 'calc(100% - 2rem)', overflowY: 'auto' }}>
                            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeInRight 0.3s ease-out' }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 800 }}>
                                            {name === 'ROOT' ? 'Main Cash Account' : 
                                             (selectedNode.type === 'vendor' ? name.replace('VENDOR_', '') : 
                                              (selectedNode.type === 'external_source' ? name.replace('EXT_', '') : name))}
                                        </h4>
                                        <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--surface-hover)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                                            {selectedNode.type.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <button onClick={onPaneClick} style={{ background: 'var(--surface-hover)', border: 'none', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', padding: 0 }}>&times;</button>
                                </div>

                                {/* Financial Summary */}
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {showStats ? (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Total Received</span>
                                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatCurrency(received)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Total Spent/Paid Out</span>
                                                <span style={{ fontWeight: 700, color: '#ef4444' }}>{formatCurrency(spent)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderTop: '1px dashed var(--border)', paddingTop: '0.6rem' }}>
                                                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>Remaining Balance</span>
                                                <span style={{ fontWeight: 800, color: balance > 0 ? '#10b981' : 'var(--text-muted)' }}>{formatCurrency(balance)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {selectedNode.type === 'external_source' ? 'Total Collected' : 'Total Procurement Paid'}
                                            </span>
                                            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(spent)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Transaction list */}
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                    <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Recent Ledger Activity
                                    </h5>
                                    {selectedNodeTransactions.length === 0 ? (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: '1rem 0' }}>No recent activity.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                                            {selectedNodeTransactions.map(tx => {
                                                const isEx = tx.lines?.some(l => l.account?.type === 'EXPENSE' && l.type === 'DEBIT');
                                                const txAmt = Number(tx.lines?.[0]?.amount) || tx.actualAmount || 0;
                                                return (
                                                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '0.8rem' }}>
                                                        <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
                                                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={tx.description}>{tx.description || 'Transaction'}</p>
                                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {tx.cashierName || 'Main'}
                                                            </p>
                                                        </div>
                                                        <span style={{ fontWeight: 700, color: isEx ? '#ef4444' : '#10b981', flexShrink: 0 }}>
                                                            {isEx ? '-' : '+'}{formatCurrency(txAmt)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Panel>
                    );
                })()}
            </ReactFlow>

            {/* Transfer Modal */}
            {transferModal && (
                <TransferModal
                    sourceNode={transferModal.sourceNode}
                    targetNode={transferModal.targetNode}
                    onConfirm={handleTransferConfirm}
                    onCancel={() => setTransferModal(null)}
                />
            )}
        </div>
    );
}
