import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { accountingApi } from '../services/api';

// ── State Shape ────────────────────────────────────────────────────────────
const initialState = {
    project: null,
    journal: [],           // All active transactions (isDeleted: false)
    categories: [],        // AccountCategory list
    phaseFinances: {},     // Map<phaseId, { received, spent, balance, budget }>
    projectFinances: null, // { received, spent, balance }
    loading: false,
    error: null,
    version: 0,            // Increment to trigger re-fetch
};

// ── Reducer ────────────────────────────────────────────────────────────────
function reducer(state, action) {
    switch (action.type) {
        case 'LOAD_START':
            return { ...state, loading: true, error: null };

        case 'LOAD_SUCCESS':
            return {
                ...state,
                loading: false,
                project: action.payload.project,
                journal: action.payload.journal,
                categories: action.payload.categories,
                phaseFinances: action.payload.phaseFinances,
                projectFinances: action.payload.projectFinances,
            };

        case 'LOAD_ERROR':
            return { ...state, loading: false, error: action.payload };

        case 'ADD_TRANSACTION':
            return { ...state, journal: [action.payload, ...state.journal] };

        case 'REMOVE_TRANSACTION':
            return {
                ...state,
                journal: state.journal.filter(tx => tx.id !== action.payload),
            };

        case 'UPDATE_TRANSACTION':
            return {
                ...state,
                journal: state.journal.map(tx =>
                    tx.id === action.payload.id ? action.payload : tx
                ),
            };

        case 'INVALIDATE':
            return { ...state, version: state.version + 1 };

        case 'RESET':
            return initialState;

        default:
            return state;
    }
}

// ── Context ────────────────────────────────────────────────────────────────
const ProjectDataContext = createContext(null);

// Module-level cache for static categories to accelerate frequent updates
let cachedCategories = null;

export function ProjectDataProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    /**
     * Loads all project data.
     * Fires parallel calls to getProject, getJournal, getPhaseFinancials
     */
    const loadProject = useCallback(async (projectId, phaseId = null) => {
        if (!projectId) return;
        dispatch({ type: 'LOAD_START' });
        try {
            const categoriesPromise = cachedCategories
                ? Promise.resolve(cachedCategories)
                : accountingApi.listCategories().then(cats => {
                    cachedCategories = cats;
                    return cats;
                });

            const [project, journal, categories] = await Promise.all([
                accountingApi.getProject(projectId),
                accountingApi.getJournal(projectId, phaseId),
                categoriesPromise,
            ]);

            // Dynamically calculate finances directly from the journal to guarantee 100% sync
            const phaseFinances = {};
            let totalProjectSpent = 0;
            let totalProjectReceived = 0;
            let totalProjectReturned = 0;

            // Initialize phases with their actual database receivedAmount, reallocatedAmount, returnedAmount and estimatedBudget
            (project.phases || []).forEach(ph => {
                const phReceived = Number(ph.receivedAmount) || 0;
                const phReallocated = Number(ph.reallocatedAmount) || 0;
                const phReturned = Number(ph.returnedAmount) || 0;
                phaseFinances[ph.id] = {
                    id: ph.id,
                    name: ph.name,
                    received: phReceived,
                    reallocated: phReallocated,
                    returned: phReturned,
                    manualReturned: 0,
                    spent: 0,
                    balance: (phReceived + phReallocated) - phReturned
                };
                totalProjectReceived += phReceived;
            });

            // Aggregate spent, received, and returned amounts from the journal
            (journal || []).forEach(tx => {
                let txSpent = 0;
                let txReceived = 0;
                let txReturned = 0;

                (tx.lines || []).forEach(line => {
                    const amt = Number(line.amount) || 0;
                    
                    // Outflows/Spent: DEBIT lines to EXPENSE accounts
                    if (line.account?.type === 'EXPENSE') {
                        // If it is 'Settlement Amount', track it as returned surplus!
                        if (line.account?.name === 'Settlement Amount') {
                            if (line.type === 'DEBIT') {
                                txReturned += amt;
                            } else if (line.type === 'CREDIT') {
                                txReturned -= amt; // Credit reduces returned
                            }
                        } else {
                            if (line.type === 'DEBIT') {
                                txSpent += amt;
                            } else if (line.type === 'CREDIT') {
                                txSpent -= amt; // Refund reduces spent
                            }
                        }
                    }

                    // Inflows/Received: CREDIT lines to EQUITY, REVENUE, or LIABILITY accounts
                    if (['EQUITY', 'REVENUE', 'LIABILITY'].includes(line.account?.type)) {
                        // Skip system automated Reallocated Fund to avoid double-counting rolled-over amounts as fresh capital
                        if (line.account?.name !== 'Reallocated Fund') {
                            if (line.type === 'CREDIT') {
                                txReceived += amt;
                            } else if (line.type === 'DEBIT') {
                                txReceived -= amt; // Debit reduces received
                            }
                        }
                    }
                });

                totalProjectSpent += txSpent;

                if (tx.phaseId && phaseFinances[tx.phaseId]) {
                    phaseFinances[tx.phaseId].spent += txSpent;
                    phaseFinances[tx.phaseId].received += txReceived;
                    phaseFinances[tx.phaseId].manualReturned += txReturned;
                }
            });

            // Recalculate phases to take maximum of database returnedAmount and manual settlement
            let recomputedProjectReturned = 0;
            Object.keys(phaseFinances).forEach(pid => {
                const dbReturned = phaseFinances[pid].returned;
                const manReturned = phaseFinances[pid].manualReturned || 0;
                const finalReturned = Math.max(dbReturned, manReturned);
                
                phaseFinances[pid].returned = finalReturned;

                // Sync the phase object inside the array so lists and modals show matching values
                const phaseObj = (project.phases || []).find(p => p.id === pid);
                if (phaseObj) {
                    phaseObj.returnedAmount = finalReturned;
                    phaseObj.isSettled = phaseObj.isSettled || manReturned > 0;
                }

                phaseFinances[pid].balance = 
                    (phaseFinances[pid].received + phaseFinances[pid].reallocated) - 
                    (phaseFinances[pid].spent + finalReturned);

                recomputedProjectReturned += finalReturned;
            });
            
            // Calculate overall project finances
            const projectFinances = {
                received: totalProjectReceived,
                spent: totalProjectSpent,
                returned: recomputedProjectReturned,
                balance: totalProjectReceived - (totalProjectSpent + recomputedProjectReturned),
            };

            dispatch({
                type: 'LOAD_SUCCESS',
                payload: { project, journal, categories, phaseFinances, projectFinances },
            });
        } catch (e) {
            console.error('ProjectDataContext load error:', e);
            dispatch({ type: 'LOAD_ERROR', payload: e.message || 'Failed to load project data' });
        }
    }, []);

    /**
     * Call after adding a transaction — optimistically updates the journal and fetches new totals.
     */
    const addTransaction = useCallback((tx) => {
        dispatch({ type: 'ADD_TRANSACTION', payload: tx });
        if (state.project?.id) loadProject(state.project.id); // Re-fetch to update totals instantly
    }, [state.project, loadProject]);

    /**
     * Call after deleting a transaction — removes it from local state instantly and fetches new totals.
     */
    const removeTransaction = useCallback((id) => {
        dispatch({ type: 'REMOVE_TRANSACTION', payload: id });
        if (state.project?.id) loadProject(state.project.id);
    }, [state.project, loadProject]);

    /**
     * Call after editing a transaction — replaces it in local state instantly and fetches new totals.
     */
    const updateTransaction = useCallback((tx) => {
        dispatch({ type: 'UPDATE_TRANSACTION', payload: tx });
        if (state.project?.id) loadProject(state.project.id);
    }, [state.project, loadProject]);

    /**
     * Forces a full re-fetch from backend. Use sparingly (e.g. after phase deletion).
     */
    const invalidate = useCallback((projectId, phaseId) => {
        dispatch({ type: 'INVALIDATE' });
        if (projectId) loadProject(projectId, phaseId);
    }, [loadProject]);

    /**
     * Clears all project data (e.g. when navigating back to Home).
     */
    const reset = useCallback(() => {
        dispatch({ type: 'RESET' });
    }, []);

    const value = {
        ...state,
        loadProject,
        addTransaction,
        removeTransaction,
        updateTransaction,
        invalidate,
        reset,
    };

    return (
        <ProjectDataContext.Provider value={value}>
            {children}
        </ProjectDataContext.Provider>
    );
}

export function useProjectData() {
    const ctx = useContext(ProjectDataContext);
    if (!ctx) throw new Error('useProjectData must be used within a ProjectDataProvider');
    return ctx;
}
