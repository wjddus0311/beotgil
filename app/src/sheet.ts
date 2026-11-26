export type Panel = 'route' | 'feedback' | 'shelters' | 'walking';
type Sheet = { panel: Panel | null; expanded: boolean };
type Action = { type: 'open' | 'toggle'; panel: Panel; expanded?: boolean }
  | { type: 'close' } | { type: 'resize'; expanded: boolean };

export const initialSheet: Sheet = { panel: null, expanded: false };

export function sheetReducer(state: Sheet, action: Action): Sheet {
  switch (action.type) {
    case 'close': return initialSheet;
    case 'resize': return state.panel ? { ...state, expanded: action.expanded } : state;
    case 'toggle':
      if (state.panel === action.panel) return initialSheet;
      return { panel: action.panel, expanded: action.expanded ?? true };
    case 'open': return { panel: action.panel, expanded: action.expanded ?? true };
  }
}
