import { Plugin, PluginKey, Transaction } from 'prosemirror-state';

let active = false;
let color = 1;
export function setRevisionMode(on: boolean, c: number) {
  active = on;
  color = c;
}

/** In revision mode, every element touched by an edit is stamped with the revision color. */
export function revisionPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('revision'),
    appendTransaction(trs, _old, state) {
      if (!active || color < 1) return null;
      const ranges: [number, number][] = [];
      for (const tr of trs) {
        if (!tr.docChanged || tr.getMeta('noRevision')) continue;
        // map earlier ranges forward and collect this transaction's changed ranges
        for (let i = 0; i < ranges.length; i++) ranges[i] = [tr.mapping.map(ranges[i][0], -1), tr.mapping.map(ranges[i][1], 1)];
        tr.mapping.maps.forEach((map, idx) => {
          map.forEach((_oS, _oE, nS, nE) => {
            const rest = tr.mapping.slice(idx + 1);
            ranges.push([rest.map(nS, -1), rest.map(nE, 1)]);
          });
        });
      }
      if (!ranges.length) return null;
      let out: Transaction | null = null;
      const size = state.doc.content.size;
      for (const [a, b] of ranges) {
        const from = Math.max(0, Math.min(a, size));
        const to = Math.max(from, Math.min(b, size));
        state.doc.nodesBetween(from, Math.min(size, to === from ? from + 1 : to), (n, pos) => {
          if (n.type.name === 'element') {
            if (n.attrs.rev !== color) {
              out = out || state.tr;
              (out as Transaction).setNodeMarkup(pos, undefined, { ...n.attrs, rev: color });
            }
            return false;
          }
          return true;
        });
      }
      if (out) (out as Transaction).setMeta('addToHistory', true).setMeta('noRevision', true);
      return out;
    },
  });
}
