import { store } from '../app/store';
import { useSelection, useStore } from './hooks';
import { currentElement } from '../editor/commands';
import { ELEMENT_BY_TYPE, detectLang, hasIndic } from '../core/elements';
import { LANG_NAMES } from '../core/types';
import { runtimeMinutes, formatMinutes } from '../core/paginate';
import { getPhoneticLang } from '../editor/phonetic';
import { t } from '../i18n';
import { halves } from '../core/stats';

export function StatusBar() {
  const s = useStore();
  useSelection();
  const st = s.view?.state;
  const layout = s.layout;
  const p = s.project;
  if (!p) return <div class="statusbar" />;
  const cur = st ? currentElement(st) : null;
  let page = 1;
  let sceneNo = '—';
  if (cur && layout) {
    const id = cur.node.attrs.id;
    page = (layout.elementPage.get(id) ?? 0) + 1;
    // current scene: last heading at or before the cursor
    let sid = '';
    st!.doc.forEach((n, _p, i) => {
      if (i <= cur.index && n.attrs.type === 'scene') sid = n.attrs.id;
    });
    if (sid) sceneNo = layout.sceneNos.get(sid) || '—';
  }
  const type = cur ? ELEMENT_BY_TYPE[cur.node.attrs.type as keyof typeof ELEMENT_BY_TYPE]?.name : '';
  const text = cur?.node.textContent || '';
  const lang = cur?.node.attrs.lang || (hasIndic(text) ? detectLang(text) : 'en');
  const ph = getPhoneticLang();
  const total = layout ? runtimeMinutes(layout, p.settings) : 0;
  const h = layout ? halves(s.elements(), layout, p.settings) : null;
  return (
    <div class="statusbar" data-tour="status">
      <span>
        {t('Page')} <b>{layout ? `${layout.pages[page - 1]?.label || page} / ${layout.pages.length}` : '…'}</b>
      </span>
      <span>
        {t('Scene')} <b>{sceneNo}</b>
      </span>
      <span>
        {t('Element')} <b>{t(type || '')}</b>
      </span>
      <span>
        {t('Language')} <b>{LANG_NAMES[lang as keyof typeof LANG_NAMES] || lang}</b>
        {ph ? <span class="half"> · typing {LANG_NAMES[ph]} (Ctrl+Space)</span> : null}
      </span>
      <span>
        {t('Runtime')} <b>{formatMinutes(total)}</b>
      </span>
      {h && h.hasInterval && (
        <span class="half">
          {t('First Half')} <b>{h.first.pages}p · {formatMinutes(h.first.minutes)}</b> | {t('Second Half')} <b>{h.second.pages}p · {formatMinutes(h.second.minutes)}</b>
        </span>
      )}
      <span style="margin-left:auto">
        {s.elements().filter((e) => e.type === 'scene').length} {t('scenes')} · {wordCountCached()} {t('words')}
      </span>
    </div>
  );
}

let wcDoc: unknown = null;
let wc = 0;
function wordCountCached() {
  const d = store.view?.state.doc;
  if (d !== wcDoc) {
    wcDoc = d;
    wc = 0;
    d?.forEach((n) => (wc += (n.textContent.match(/\S+/g) || []).length));
  }
  return wc;
}
