import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  aiCopilotOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAiCopilotOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  aiCopilotOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setAiCopilotOpen: (aiCopilotOpen) => set({ aiCopilotOpen }),
}));
