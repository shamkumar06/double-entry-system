import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, Handle, Position, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useProjectData } from '../context/ProjectDataContext';
import { Activity, Target, Truck, Users, Crown, Banknote, AlertCircle, Info, ChevronRight, PieChart } from 'lucide-react';

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
        <Handle type="target" position={Position.Top} style={{ background: color, border: 'none', width: '8px', height: '8px' }} />
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
        <Handle type="source" position={Position.Bottom} style={{ background: color, border: 'none', width: '8px', height: '8px' }} />
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

// === MAIN COMPONENT ===

export default function FinancialMindMap() {
    const { journal, members, projectFinances } = useProjectData();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [dashboardStats, setDashboardStats] = useState({});

    // Graph Generation Logic
    useEffect(() => {
        if (!journal || !members) return;

        const nodesMap = new Map();
        const edgesMap = new Map();

        const addNode = (id, title, type, amount = 0) => {
            if (!nodesMap.has(id)) {
                nodesMap.set(id, { id, type, data: { title, amount: 0 } });
            }
            if (amount > 0) {
                nodesMap.get(id).data.amount += amount;
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
            edgesMap.get(edgeId).data.amount += amount;
            edgesMap.get(edgeId).data.count += 1;
        };

        addNode('ROOT', 'Main Cash Account', 'root');
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
                }
            });

            // Funding (from ROOT to Receiver)
            if (senders.length === 0 && receivers.length > 0) {
                receivers.forEach(r => {
                    const member = members.find(m => m.name === r.name);
                    const role = member?.role === 'GUIDE' ? 'guide' : 'student';
                    addNode('ROOT', 'Main Cash Account', 'root', r.amount);
                    addNode(r.name, r.name, role, r.amount);
                    addEdge('ROOT', r.name, r.amount);
                    totalDistributed += r.amount;
                });
            }

            // Internal Transfer
            if (senders.length > 0 && receivers.length > 0) {
                senders.forEach(s => {
                    receivers.forEach(r => {
                        const amount = Math.min(s.amount, r.amount);
                        const senderRole = members.find(m => m.name === s.name)?.role === 'GUIDE' ? 'guide' : 'student';
                        const receiverRole = members.find(m => m.name === r.name)?.role === 'GUIDE' ? 'guide' : 'student';
                        addNode(s.name, s.name, senderRole, 0);
                        addNode(r.name, r.name, receiverRole, amount);
                        addEdge(s.name, r.name, amount);
                    });
                });
            }

            // Vendor Payment
            if (senders.length > 0 && expenses.length > 0) {
                senders.forEach(s => {
                    const vendorName = tx.party || 'Unknown Vendor';
                    const vendorId = `VENDOR_${vendorName}`;
                    const amount = s.amount; // Use the sender's credit amount for this specific vendor link
                    addNode(vendorId, vendorName, 'vendor', amount);
                    const senderRole = members.find(m => m.name === s.name)?.role === 'GUIDE' ? 'guide' : 'student';
                    addNode(s.name, s.name, senderRole, 0);
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
            
            if (sourceNode?.type === 'student' || sourceNode?.type === 'sub_cashier' || sourceNode?.type === 'procuring_student') {
                if (targetNode?.type === 'student' || targetNode?.type === 'guide') {
                    sourceNode.type = 'sub_cashier';
                }
                if (targetNode?.type === 'vendor') {
                    if (sourceNode.type !== 'sub_cashier') sourceNode.type = 'procuring_student';
                }
            }
        });

        // Add edge labels
        Array.from(edgesMap.values()).forEach(edge => {
            edge.label = formatCurrency(edge.data.amount);
            edge.labelStyle = { fill: 'var(--text-main)', fontWeight: 700, fontSize: 12 };
            edge.labelBgStyle = { fill: 'var(--surface)', fillOpacity: 0.8 };
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
        </div>
    );
}
