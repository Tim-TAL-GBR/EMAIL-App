import { create } from 'zustand';
import { Email } from './emailStore';

export type ComposerMode = 'reply' | 'forward' | 'new';

interface ComposerState {
  isOpen: boolean;
  mode: ComposerMode;
  inboxId: string;
  sourceEmail?: Email;
  draftToResume?: any;

  openComposer: (params: {
    mode: ComposerMode;
    inboxId: string;
    sourceEmail?: Email;
    draftToResume?: any;
  }) => void;
  closeComposer: () => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  isOpen: false,
  mode: 'new',
  inboxId: '',

  openComposer: (params) => set({
    isOpen: true,
    mode: params.mode,
    inboxId: params.inboxId,
    sourceEmail: params.sourceEmail,
    draftToResume: params.draftToResume,
  }),

  closeComposer: () => set({
    isOpen: false,
    sourceEmail: undefined,
    draftToResume: undefined,
  })
}));
