'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShortcutItem {
  keys: string[];
  actionKey: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: ['⌘', 'K'], actionKey: 'openCommandPalette' },
  { keys: ['1-9'], actionKey: 'navigateSections' },
  { keys: ['?'], actionKey: 'showHelp' },
  { keys: ['N'], actionKey: 'newItem' },
  { keys: ['E'], actionKey: 'toggleSidebar' },
  { keys: ['D'], actionKey: 'toggleDarkMode' },
  { keys: ['L'], actionKey: 'switchLanguage' },
  { keys: ['Esc'], actionKey: 'closeDialog' },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const t = useTranslations('common');

  const getActionLabel = (actionKey: string): string => {
    switch (actionKey) {
      case 'openCommandPalette': return t('openCommandPalette');
      case 'navigateSections': return t('navigateSections');
      case 'showHelp': return t('showHelp');
      case 'newItem': return t('newItem');
      case 'toggleSidebar': return t('toggleSidebar');
      case 'toggleDarkMode': return t('toggleDarkMode');
      case 'switchLanguage': return t('switchLanguage');
      case 'closeDialog': return t('closeDialog');
      default: return actionKey;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>⌨️</span>
            {t('keyboardShortcuts')}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-start pb-2 text-sm font-medium text-muted-foreground">{t('shortcut')}</th>
                <th className="text-start pb-2 text-sm font-medium text-muted-foreground">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map((shortcut) => (
                <tr key={shortcut.actionKey} className="border-b last:border-0">
                  <td className="py-2.5">
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="pointer-events-none inline-flex h-6 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 text-sm">{getActionLabel(shortcut.actionKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to trigger the dialog with ? key
export function useKeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
