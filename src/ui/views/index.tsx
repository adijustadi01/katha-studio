import { store } from '../../app/store';
import { useStore } from '../hooks';
import { viewRegistry } from './registry';

export function MainViews() {
  const s = useStore();
  const V = viewRegistry[s.main];
  return (
    <div class="board">
      <div class="row" style="margin-bottom:10px">
        <button onClick={() => store.setMain('script')}>← Back to script</button>
      </div>
      {V ? <V /> : <div class="muted">This view is not available yet.</div>}
    </div>
  );
}
