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

export function ProjectDataProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    /**
     * Loads all project data in 3 parallel API calls.
     * Fires: getProject, getJournal, getPhaseFinancials
     */
    const loadProject = useCallback(async (projectId, phaseId = null) => {
        if (!projectId) return;
        dispatch({ type: 'LOAD_START' });
        try {
            const [project, journal, categories, phaseFinancesArr] = await Promise.all([
                accountingApi.getProject(projectId),
                accountingApi.getJournal(projectId, phaseId),
                accountingApi.listCategories(),
                accountingApi.getPhaseFinancials(projectId).catch(() => []),
            ]);

            // Dynamically calculate finances directly from the journal to guarantee 100% sync
            const phaseFinances = {};
            let totalProjectSpent = 0;

            // Initialize phases
            (project.phases || []).forEach(ph => {
                phaseFinances[ph.id] = {
                    id: ph.id,
                    name: ph.name,
                    received: Number(ph.estimatedBudget) || 0, // Fallback to estimated budget as allocation
                    spent: 0,
                    balance: Number(ph.estimatedBudget) || 0
                };
            });

            // Aggregate spent amounts from the journal
            (journal || []).forEach(tx => {
                let txExpense = 0;
                // Sum all DEBIT lines that represent an actual outflow/expense (typically EXPENSE accounts)
                (tx.lines || []).forEach(line => {
                    if (line.type === 'DEBIT' && line.account?.type === 'EXPENSE') {
                        txExpense += Number(line.amount);
                    }
                });

                // If no direct expense was found, fallback to the primary debit line amount to ensure we don't show $0
                if (txExpense === 0 && tx.lines?.length > 0) {
                    const debitLine = tx.lines.find(l => l.type === 'DEBIT');
                    if (debitLine) txExpense = Number(debitLine.amount);
                }
                
                totalProjectSpent += txExpense;
                
                if (tx.phaseId && phaseFinances[tx.phaseId]) {
                    phaseFinances[tx.phaseId].spent += txExpense;
                    phaseFinances[tx.phaseId].balance = phaseFinances[tx.phaseId].received - phaseFinances[tx.phaseId].spent;
                }
            });
            
            // Calculate overall project finances
            const totalProjectReceived = Number(project.totalFunds) || 0;
            const projectFinances = {
                received: totalProjectReceived,
                spent: totalProjectSpent,
                balance: totalProjectReceived - totalProjectSpent,
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
