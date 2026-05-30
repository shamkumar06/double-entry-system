import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, Handle, Position, Panel, addEdge as rfAddEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useProjectData } from '../context/ProjectDataContext';
import { Activity, Target, Truck, Users, Crown, Banknote, AlertCircle, Info, ChevronRight, PieChart, ArrowRight, X, Zap } from 'lucide-react';

// === HELPER FUNCTIONS ===
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

// === CUSTOM NODES ===

const NodeWrapper = ({ children, color, title, icon: Icon, amount, role, selected }) => (
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
                <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{title}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{role}</p>
            </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Handled:</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: color }}>{formatCurrency(amount)}</span>
        </div>
        <Handle type="source" position={Position.Bottom} style={{ background: color, border: '2px solid var(--surface)', width: '10px', height: '10px', cursor: 'crosshair' }} />
    </div>
);

const RootNode = ({ data, selected }) => <NodeWrapper {...data} icon={Banknote} color="#10b981" role="Funding Source" selected={selected} />;
const GuideNode = ({ data, selected }) => <NodeWrapper {...data} icon={Crown} color="#3b82f6" role="Main Cashier" selected={selected} />;
const SubCashierNode = ({ data, selected }) => <NodeWrapper {...data} icon={Users} color="#14b8a6" role="Sub-Cashier" selected={selected} />;
const ProcuringNode = ({ data, selected }) => <NodeWrapper {...data} icon={Users} color="#f59e0b" role="Procuring Student" selected={selected} />;
const VendorNode = ({ data, selected }) => <NodeWrapper {...data} icon={Truck} color="#ef4444" role="Vendor" selected={selected} />;

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
const TransferModal = ({ sourceNode, targetNode, onConfirm, onCancel }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) return;
        onConfirm({ amount: Number(amount), description: description || `Transfer from ${sourceNode.data.title} to ${targetNode.data.title}` });
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
                    padding: '1rem', borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08))',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.2)', color: '#10b981',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 0.4rem', fontWeight: 800, fontSize: '0.85rem'
                        }}>{sourceNode.data.title.charAt(0)}</div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{sourceNode.data.title}</p>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{sourceNode.type.replace('_', ' ')}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        <ArrowRight size={20} color="#10b981" />
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transfer</span>
                    </div>

                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 0.4rem', fontWeight: 800, fontSize: '0.85rem'
                        }}>{targetNode.data.title.charAt(0)}</div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{targetNode.data.title}</p>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{targetNode.type.replace('_', ' ')}</p>
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
                            placeholder={`Fund transfer to ${targetNode.data.title}`}
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

    // Graph Generation Logic
    useEffect(() => {
        if (!journal || !members || !cashierFinances) return;

        const nodesMap = new Map();
        const edgesMap = new Map();

        const addNode = (id, title, type, exactAmount = null) => {
            if (!nodesMap.has(id)) {
                nodesMap.set(id, { id, type, data: { title, amount: exactAmount || 0 } });
            } else if (exactAmount !== null) {
                nodesMap.get(id).data.amount = exactAmount;
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
        addNode('ROOT', 'Main Cash Account', 'root', projectFinances?.received || 0);
        (members || []).forEach(m => {
            if (m.isActive === false) return;
            const cf = cashierFinances[m.name] || { received: 0 };
            let role = 'sub_cashier';
            if (m.role === 'GUIDE') role = 'guide';
            else if (m.role === 'PROCURING_STUDENT') role = 'procuring_student';
            
            addNode(m.name, m.name, role, cf.received);
        });

        // Add fallback for cashiers with transactions who are not active members
        Object.values(cashierFinances).forEach(cf => {
            if (!nodesMap.has(cf.name)) {
                addNode(cf.name, cf.name, 'sub_cashier', cf.received);
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
                        addNode(vendorId, vendorName, 'vendor', amount);
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

    const handleTransferConfirm = useCallback(({ amount, description }) => {
        if (!transferModal || !onTransferRequest) return;
        
        const { sourceNode, targetNode } = transferModal;
        
        onTransferRequest({
            sourceId: sourceNode.id,
            sourceName: sourceNode.data.title,
            sourceType: sourceNode.type,
            targetId: targetNode.id,
            targetName: targetNode.data.title,
            targetType: targetNode.type,
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
                
                <Panel position="top-left" style={{ margin: '1rem', zIndex: 100 }}>
                    <div className="glass-panel" style={{ padding: '1.5rem', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

                {selectedNode && (
                    <Panel position="top-right" style={{ margin: '1rem', width: '350px', zIndex: 100 }}>
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeInRight 0.3s ease-out' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>{selectedNode.data.title}</h4>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--surface-hover)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {selectedNode.type.replace('_', ' ')}
                                    </span>
                                </div>
                                <button onClick={() => onPaneClick()} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
                            </div>
                            
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>Total Handled / Received</p>
                                <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 800 }}>{formatCurrency(selectedNode.data.amount)}</h3>
                            </div>

                            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '0.75rem' }}>
                                <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Network Trace</p>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click outside this panel to clear trace highlights across the network.</p>
                                </div>
                            </div>
                        </div>
                    </Panel>
                )}
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
