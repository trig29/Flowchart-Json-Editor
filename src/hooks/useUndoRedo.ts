import { useState, useCallback, useRef } from 'react';

export interface UseUndoRedoOptions<T> {
  maxHistory?: number;
}

export interface UseUndoRedoResult<T> {
  state: T;
  stateRef: React.MutableRefObject<T>; // Exposed for immediate access in event handlers
  setState: (newState: T) => void; // Direct update (no history)
  setStateWithHistory: (newState: T) => void; // Update and push to history
  startTransaction: () => void; // Mark start of a continuous operation (drag)
  commitTransaction: () => void; // Mark end of a continuous operation
  cancelTransaction: () => void; // Revert to transaction start
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: () => void;
  isTransactionActive: () => boolean;
}

export function useUndoRedo<T>(initialState: T, options: UseUndoRedoOptions<T> = {}): UseUndoRedoResult<T> {
  const { maxHistory = 100 } = options;

  const [state, _setState] = useState<T>(initialState);
  const stateRef = useRef<T>(initialState);
  
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);
  
  // Use state for depths to trigger re-renders of UI controls
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  const updateDepths = useCallback(() => {
    setUndoDepth(undoStack.current.length);
    setRedoDepth(redoStack.current.length);
  }, []);

  const setState = useCallback((newState: T) => {
    stateRef.current = newState;
    _setState(newState);
  }, []);

  const setStateWithHistory = useCallback((newState: T) => {
    // Check strict equality to prevent useless history
    if (newState === stateRef.current) return;

    undoStack.current.push(stateRef.current);
    if (undoStack.current.length > maxHistory) {
      undoStack.current.shift();
    }
    
    // Clear redo stack on new change
    redoStack.current = [];
    
    stateRef.current = newState;
    _setState(newState);
    
    updateDepths();
  }, [maxHistory, updateDepths]);

  const transactionStartRef = useRef<T | null>(null);

  const startTransaction = useCallback(() => {
    // Only set if not already in transaction to support nested calls if any (though flat is better)
    if (transactionStartRef.current === null) {
      console.log('useUndoRedo: Transaction Started');
      transactionStartRef.current = stateRef.current;
    }
  }, []);

  const commitTransaction = useCallback(() => {
    if (transactionStartRef.current !== null) {
      // If state changed since transaction start, push the START state to undo stack
      if (transactionStartRef.current !== stateRef.current) {
        console.log('useUndoRedo: Transaction Committed (Changed)');
        undoStack.current.push(transactionStartRef.current);
        if (undoStack.current.length > maxHistory) {
          undoStack.current.shift();
        }
        redoStack.current = [];
        updateDepths();
      } else {
        console.log('useUndoRedo: Transaction Committed (No Change)');
      }
      transactionStartRef.current = null;
    } else {
      console.log('useUndoRedo: Commit called but no transaction active');
    }
  }, [maxHistory, updateDepths]);

  const cancelTransaction = useCallback(() => {
    if (transactionStartRef.current !== null) {
      console.log('useUndoRedo: Transaction Cancelled');
      const prevState = transactionStartRef.current;
      stateRef.current = prevState;
      _setState(prevState);
      transactionStartRef.current = null;
    }
  }, []);

  const undo = useCallback(() => {
    // Cancel any active transaction
    if (transactionStartRef.current !== null) {
        console.log('useUndoRedo: Undo called during transaction - cancelling transaction first');
        transactionStartRef.current = null;
    }

    const prev = undoStack.current.pop();
    if (prev === undefined) return;

    // Push current state to redo
    redoStack.current.push(stateRef.current);
    if (redoStack.current.length > maxHistory) {
      redoStack.current.shift();
    }

    stateRef.current = prev;
    _setState(prev);
    
    updateDepths();
  }, [maxHistory, updateDepths]);

  const redo = useCallback(() => {
    // Cancel any active transaction
    if (transactionStartRef.current !== null) {
        transactionStartRef.current = null;
    }

    const next = redoStack.current.pop();
    if (next === undefined) return;

    // Push current state to undo
    undoStack.current.push(stateRef.current);
    if (undoStack.current.length > maxHistory) {
      undoStack.current.shift();
    }

    stateRef.current = next;
    _setState(next);
    
    updateDepths();
  }, [maxHistory, updateDepths]);

  const resetHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    transactionStartRef.current = null;
    updateDepths();
  }, [updateDepths]);

  const isTransactionActive = useCallback(() => {
    return transactionStartRef.current !== null;
  }, []);

  return {
    state,
    stateRef,
    setState,
    setStateWithHistory,
    startTransaction,
    commitTransaction,
    cancelTransaction,
    undo,
    redo,
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
    resetHistory,
    isTransactionActive
  };
}
