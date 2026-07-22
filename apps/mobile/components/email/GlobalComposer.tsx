import React from 'react';
import { useComposerStore } from '../../stores/composerStore';
import { EmailComposer } from './EmailComposer';

export function GlobalComposer() {
  const { isOpen, mode, inboxId, sourceEmail, draftToResume, closeComposer } = useComposerStore();

  return (
    <EmailComposer
      visible={isOpen}
      mode={mode}
      inboxId={inboxId}
      sourceEmail={sourceEmail}
      draftToResume={draftToResume}
      onClose={closeComposer}
    />
  );
}
