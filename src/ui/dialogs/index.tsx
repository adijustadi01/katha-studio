import { store } from '../../app/store';
import { useStore } from '../hooks';
import { FindDialog } from './Find';
import { ExportPdfDialog } from './ExportPdf';
import { SettingsDialog, TemplatesDialog, TitlePageDialog } from './Settings';
import { NewDialog, AboutDialog, ShortcutsDialog, NoteDialog, SnapshotDialog, DictionaryDialog, BlockDialog, BackupsDialog } from './Misc';
import { Dialog } from './Dialog';
import { lazyDialogs } from './lazy';

export function Dialogs() {
  const s = useStore();
  const d = s.dialog;
  if (!d) return null;
  const needsProject = !['new', 'about', 'shortcuts', 'settings', 'backups', 'help', 'tutorial', 'dictionary'].includes(d.kind);
  if (needsProject && !store.project) return null;
  switch (d.kind) {
    case 'find':
      return <FindDialog />;
    case 'pdf':
      return <ExportPdfDialog />;
    case 'settings':
      return <SettingsDialog tab={d.data?.tab} />;
    case 'templates':
      return <TemplatesDialog />;
    case 'titlepage':
      return <TitlePageDialog />;
    case 'new':
      return <NewDialog />;
    case 'about':
      return <AboutDialog />;
    case 'shortcuts':
      return <ShortcutsDialog />;
    case 'note':
      return <NoteDialog />;
    case 'snapshot':
      return <SnapshotDialog />;
    case 'dictionary':
      return <DictionaryDialog />;
    case 'block':
      return <BlockDialog id={d.data.id} />;
    case 'backups':
      return <BackupsDialog />;
  }
  const L = lazyDialogs[d.kind];
  if (L) return <L {...(d.data || {})} />;
  return (
    <Dialog title={d.kind}>
      <p>Not available.</p>
    </Dialog>
  );
}
