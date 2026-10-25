import { useEffect } from 'preact/hooks';
import { store } from '../app/store';
import { prefs } from '../app/prefs';
import { useStore } from './hooks';
import { MenuBar } from './MenuBar';
import { Toolbar } from './Toolbar';
import { EditorPane } from './EditorPane';
import { StatusBar } from './StatusBar';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { Welcome } from './Welcome';
import { Dialogs } from './dialogs';
import { MainViews } from './views';
import { useBuiltInMenuBar } from '../platform';

export function App() {
  const s = useStore();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.theme === 'dark');
    document.body.classList.toggle('dark', prefs.theme === 'dark');
  });
  return (
    <div class={'app' + (prefs.theme === 'dark' ? ' dark' : '')}>
      {useBuiltInMenuBar(prefs.systemMenuBar) ? <MenuBar /> : <div />}
      {s.project ? <Toolbar /> : <div />}
      {s.project ? (
        <div class="body">
          <Sidebar />
          <main class="main">
            <div style={{ display: s.main === 'script' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
              <EditorPane />
            </div>
            {s.main !== 'script' && <MainViews />}
          </main>
          <RightPanel />
        </div>
      ) : (
        <Welcome />
      )}
      {s.project ? <StatusBar /> : <div />}
      <Dialogs />
      <div class="toasts">
        {s.toasts.map((t) => (
          <div key={t.id} class={'toast ' + t.kind}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function useBeforeUnload() {
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (store.project && store.dirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);
}
