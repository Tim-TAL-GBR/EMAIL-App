import { useEffect } from 'react';
import { Platform } from 'react-native';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    if (Platform.OS !== 'macos' && Platform.OS !== 'web') return;

    function handleKeyDown(e: KeyboardEvent) {
      const key = [
        e.metaKey ? 'Cmd' : '',
        e.ctrlKey ? 'Ctrl' : '',
        e.shiftKey ? 'Shift' : '',
        e.altKey ? 'Alt' : '',
        e.key.toUpperCase(),
      ].filter(Boolean).join('+');

      const action = shortcuts[key];
      if (action) {
        e.preventDefault();
        action();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
