import { AppState } from '../types/index';
import { createSampleWedding } from './sampleEvents';

const STORAGE_KEY = 'gatherly_state_v1';

export function loadStoredState(): AppState {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Validate schema essentials
        if (parsed.event && parsed.categories && Array.isArray(parsed.categories)) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse stored Gatherly state, resetting to default:', err);
  }
  return createSampleWedding();
}

export function saveStateToStorage(state: AppState): boolean {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to save Gatherly state to localStorage:', err);
    return false;
  }
}

export function exportStateToJson(state: AppState): void {
  const jsonString = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeTitle = state.event.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const filename = `gatherly_backup_${safeTitle}_${new Date().toISOString().split('T')[0]}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function validateAndImportState(jsonString: string): { success: boolean; state?: AppState; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Uploaded file is not a valid JSON object.' };
    }

    if (!parsed.event || !parsed.event.title || !parsed.event.type) {
      return { success: false, error: 'Missing core event metadata (title or event type).' };
    }

    if (!Array.isArray(parsed.categories)) {
      return { success: false, error: 'Corrupt budget categories list.' };
    }

    // Fill optional missing arrays for backwards-compatibility
    const sanitizedState: AppState = {
      event: parsed.event,
      categories: parsed.categories,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
      guests: Array.isArray(parsed.guests) ? parsed.guests : [],
      schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [],
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      chatHistory: Array.isArray(parsed.chatHistory) ? parsed.chatHistory : [],
      proposalsHistory: Array.isArray(parsed.proposalsHistory) ? parsed.proposalsHistory : [],
      aiConfig: parsed.aiConfig || {
        provider: 'offline',
        apiKey: '',
        model: 'offline-deterministic',
        discloseDataSharing: false,
      },
    };

    saveStateToStorage(sanitizedState);
    return { success: true, state: sanitizedState };
  } catch (err: any) {
    return { success: false, error: `Invalid JSON file syntax: ${err?.message || 'Parse error'}` };
  }
}

export function clearAllStoredData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
}
