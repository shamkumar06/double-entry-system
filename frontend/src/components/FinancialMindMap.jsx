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

const nodeTypes = {
    root: RootNode,
    guide: GuideNode,
    sub_cashier: SubCashierNode,
    procuring_student: ProcuringNode,
    vendor: VendorNode
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
                            background: sender.type === 'root' ? 'rgba(99, 102, 241, 0.2)' : (sender.role === 'GUIDE' ? 'rgba(99, 102, 241, 0.2)' : (sender.role === 'STUDENT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)')),
                            color: sender.type === 'root' ? '#6366f1' : (sender.role === 'GUIDE' ? '#6366f1' : (sender.role === 'STUDENT' ? '#10b981' : '#f59e0b')),
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
                            background: receiver.type === 'root' ? 'rgba(99, 102, 241, 0.2)' : (receiver.role === 'GUIDE' ? 'rgba(99, 102, 241, 0.2)' : (receiver.role === 'STUDENT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)')),
                            color: receiver.type === 'root' ? '#6366f1' : (receiver.role === 'GUIDE' ? '#6366f1' : (receiver.role === 'STUDENT' ? '#10b981' : '#f59e0b')),
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
    const { journal, members, projectFinances, cashierFinances } = useProjectData();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [dashboardStats, setDashboardStats] = useState({});
    const [transferModal, setTransferModal] = useState(null); // { sourceNode, targetNode }
    const [isPanelMinimized, setIsPanelMinimized] = useState(true);

    // Graph Generation Logic
    useEffect(() => {
        if (!journal || !members || !cashierFinances) return;

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
        addNode('ROOT', 'Main Cash Account', 'root', projectFinances?.received || 0, projectFinances?.balance || 0);
        (members || []).forEach(m => {
            if (m.isActive === false) return;
            const cf = cashierFinances[m.name] || { received: 0, holding: 0 };
            let role = 'sub_cashier';
            if (m.role === 'GUIDE') role = 'guide';
            else if (m.role === 'PROCURING_STUDENT') role = 'procuring_student';
            
            addNode(m.name, m.name, role, cf.received, cf.holding);
        });

        // Add fallback for cashiers with transactions who are not active members
        Object.values(cashierFinances).forEach(cf => {
            if (!nodesMap.has(cf.name)) {
                addNode(cf.name, cf.name, 'sub_cashier', cf.received, cf.holding);
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

        journal.forEach(tx => {
            const senders = [];
            const receivers = [];
            const expenses = [];
            
            (tx.lines || []).forEach(line => {
                const amt = Number(line.amount) || 0;
                const acctName = line.account?.name;
                const acctType = line.account?.type;
                
                const isMember = members.some(m => m.name === acctName);
                
                if (acctType === 'ASSET' && isMember) {
                    if (line.type === 'CREDIT') senders.push({ name: acctName, amount: amt });
                    if (line.type === 'DEBIT') receivers.push({ name: acctName, amount: amt });
                } else if (acctType === 'EXPENSE' && line.type === 'DEBIT') {
                    expenses.push({ amount: amt });
                } else if (acctType === 'INCOME' && line.type === 'CREDIT') {
                    // Explicit income source
                }
            });

            // Funding (from ROOT to Receiver)
            if (senders.length === 0 && receivers.length > 0) {
                receivers.forEach(r => {
                    addEdge('ROOT', r.name, r.amount);
                    totalDistributed += r.amount;
                });
            }

            // Internal Transfer
            if (senders.length > 0 && receivers.length > 0) {
                senders.forEach(s => {
                    receivers.forEach(r => {
                        const amount = Math.min(s.amount, r.amount);
                        addEdge(s.name, r.name, amount);
                    });
                });
            }

            // Vendor Payment
            if (senders.length > 0 && expenses.length > 0) {
                senders.forEach(s => {
                    const vendorName = tx.toEntity || 'Unknown Vendor';
                    const vendorId = `VENDOR_${vendorName}`;
                    const amount = expenses.reduce((sum, e) => sum + e.amount, 0); 
                    
                    // Add vendor node (amounts accumulate for vendors)
                    if (!nodesMap.has(vendorId)) {
                        addNode(vendorId, vendorName, 'vendor', amount, 0);
                    } else {
                        nodesMap.get(vendorId).data.amount += amount;
                    }
                    
                    addEdge(s.name, vendorId, amount);
                    totalVendors.add(vendorName);
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

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        
        setDashboardStats({
            totalDistributed,
            vendorCount: totalVendors.size,
            pendingCount
        });

    }, [journal, members]);

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
        if (name === 'ROOT') {
            return (journal || []).filter(tx => 
                tx.lines?.some(l => l.account?.name === 'Main Cash Account')
            ).slice(0, 10);
        }
        if (selectedNode.type === 'vendor') {
            const vendorName = name.replace('VENDOR_', '');
            return (journal || []).filter(tx => 
                tx.toEntity === vendorName
            ).slice(0, 10);
        }
        return (journal || []).filter(tx => 
            tx.cashierName === name || tx.lines?.some(l => l.account?.name === name)
        ).slice(0, 10);
    }, [selectedNode, journal]);

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
                            <div>
                                <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Activity color="var(--primary)" size={20} />
                                    Financial Intelligence
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interactive Graph Topology</p>
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
                        received = projectFinances?.received || 0;
                        spent = projectFinances?.spent || 0;
                        balance = projectFinances?.balance || 0;
                    } else if (selectedNode.type === 'vendor') {
                        showStats = false;
                        spent = selectedNode.data.amount;
                    } else {
                        const cf = cashierFinances[name] || { received: 0, spent: 0, holding: 0 };
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
                                            {name === 'ROOT' ? 'Main Cash Account' : (selectedNode.type === 'vendor' ? name.replace('VENDOR_', '') : name)}
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
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Total Procurement Paid</span>
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
