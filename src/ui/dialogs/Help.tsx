import { useState } from 'preact/hooks';
import { Dialog } from './Dialog';
import { lazyDialogs } from './lazy';
import { store } from '../../app/store';
import { runCommand } from '../../app/commands';

interface Section {
  id: string;
  title: string;
  img?: string;
  html: string;
}

const k = (s: string) => s.split('+').map((x) => `<kbd>${x}</kbd>`).join('+');

const SECTIONS: Section[] = [
  {
    id: 'start',
    title: '1. Getting started',
    img: 'welcome.png',
    html: `<p>Katha Studio is a screenplay writer made for Indian film and OTT. It formats your script to industry standards automatically, so you only think about the story.</p>
<ol><li>On the Welcome screen, pick <b>Indian Standard (A4)</b> for a new script, or open the <b>sample screenplay "Theeram"</b> to explore every feature.</li>
<li>Start typing. The first line is a <b>Scene Heading</b> — type <code>int.</code> or <code>ext.</code> and the suggestions do the rest.</li>
<li>Your work is <b>saved automatically</b> every few seconds. Press ${k('Ctrl+S')} once to choose where the file lives on your computer.</li></ol>
<p>Your scripts never leave your computer. There are no accounts and no cloud.</p>`,
  },
  {
    id: 'writing',
    title: '2. Writing with the keyboard',
    img: 'editor.png',
    html: `<p>A screenplay is made of <b>elements</b>: Scene Heading, Action, Character, Parenthetical, Dialogue, Transition and more. The element type is shown at the top left and in the status bar.</p>
<table class="grid"><tr><th>You are in…</th><th>Press</th><th>You get</th></tr>
<tr><td>Scene Heading</td><td>${k('Enter')}</td><td>Action</td></tr>
<tr><td>Action</td><td>${k('Enter')}</td><td>Action</td></tr>
<tr><td>Action (empty line)</td><td>${k('Tab')}</td><td>Character</td></tr>
<tr><td>Character</td><td>${k('Enter')}</td><td>Dialogue</td></tr>
<tr><td>Dialogue</td><td>${k('Tab')}</td><td>Parenthetical (for actor directions like <i>(softly)</i>)</td></tr>
<tr><td>Dialogue</td><td>${k('Enter')}</td><td>Action — then ${k('Tab')} for the next Character</td></tr>
<tr><td>Character (empty)</td><td>${k('Tab')}</td><td>Transition (CUT TO:)</td></tr></table>
<p>Jump straight to any element with ${k('Ctrl+1')} Scene · ${k('Ctrl+2')} Action · ${k('Ctrl+3')} Character · ${k('Ctrl+4')} Parenthetical · ${k('Ctrl+5')} Dialogue · ${k('Ctrl+6')} Transition · ${k('Ctrl+7')} Shot · ${k('Ctrl+8')} Song · ${k('Ctrl+9')} General. In a browser tab, use ${k('Alt')} instead of ${k('Ctrl')}.</p>
<p><b>SmartType</b> suggests scene prefixes (INT., EXT.), locations you already used, times (DAY, NIGHT, DAWN, DUSK…), character names, extensions like (V.O.) and transitions. Use ${k('↑')}${k('↓')} and ${k('Enter')} to accept, ${k('Esc')} to ignore.</p>
<p>When the same character speaks again after some action, <b>(CONT'D)</b> is added automatically. Dual dialogue (two people speaking at once): put the cursor in the first speech and press ${k('Ctrl+D')}.</p>`,
  },
  {
    id: 'indic',
    title: '3. Typing Tamil, Telugu and more',
    img: 'phonetic.png',
    html: `<p>Click <b>தமிழ்</b> or <b>తెలుగు</b> in the toolbar (or press ${k('Ctrl+Space')}) and type in English letters — the native script appears as you type:</p>
<ul><li><code>vanakkam</code> → வணக்கம் · <code>thambi</code> → தம்பி · <code>enna da</code> → என்ன டா</li>
<li><code>ela unnav</code> → ఎలా ఉన్నావ్ · <code>nenu</code> → నేను · <code>manchi</code> → మంచి</li></ul>
<p>A small list shows alternatives (for example ன / ண / ந). Use ${k('↑')}${k('↓')} or press the number, and Katha <b>remembers your choice</b> next time. Press ${k('Esc')} to keep the English letters. Capital letters give special sounds: <code>N</code> = ண/ణ, <code>L</code> = ள/ళ, <code>T</code>/<code>D</code> = retroflex, <code>zh</code> = ழ.</p>
<p>Hindi, Malayalam and Kannada work the same way. You can also keep using the Windows Indic keyboard or Google Input Tools — Katha steps aside automatically.</p>
<p><b>Convert tools</b> (Script menu): select Tanglish/Tenglish text and convert it to Tamil/Telugu script, or convert native script into readable English letters.</p>`,
  },
  {
    id: 'bilingual',
    title: '4. Bilingual dialogue for actors',
    img: 'bilingual.png',
    html: `<p>Every Tamil or Telugu dialogue can show two extra lines:</p>
<ol><li>an automatic <b>Roman transliteration</b> (so actors and crew who can't read the script can still say the line), and</li>
<li>an optional <b>English meaning</b> — type it in the dotted line under the dialogue.</li></ol>
<p>Show or hide these on screen from <b>View</b>, and choose whether they print in <b>File → Export PDF</b> ("Bilingual actor version").</p>`,
  },
  {
    id: 'saving',
    title: '5. Saving, backups and recovery',
    html: `<p>Katha Studio is built so that you never lose work:</p>
<ul><li><b>Autosave</b> every few seconds (change it in Settings → Saving).</li>
<li><b>Desktop app:</b> your <code>.katha</code> file is saved in place; the last 50 versions and one copy per day are kept in <i>Documents\\Katha Studio Backups</i>. If the computer crashes, Katha offers to recover your work when it starts again.</li>
<li><b>Browser:</b> a copy is always kept inside the browser. In Chrome and Edge the file on your disk is updated directly after you save it once. Use <b>File → Download backup</b> regularly — and before clearing your browser data.</li>
<li><b>File → Backups &amp; Recovery</b> lists every backup; click Restore to bring one back.</li></ul>
<p>A <code>.katha</code> file is a single file containing your script, character photos, mood boards and version history. Double-click it to open in the desktop app.</p>`,
  },
  {
    id: 'pages',
    title: '6. Pages, views and formatting',
    html: `<p><b>Page View</b> shows exact printed pages: page breaks never leave a scene heading, character or parenthetical alone at the bottom, and long speeches split at a sentence with <b>(MORE)</b> and <b>NAME (CONT'D)</b>. <b>Draft View</b> shows the same text without page gaps; <b>Speed View</b> hides page breaks entirely for fast writing. <b>Focus Mode</b> dims everything except your current line.</p>
<p>The status bar always shows page count, estimated runtime (about one minute per page) and — once you add an <b>Interval</b> — the First Half and Second Half separately. Indian-language pages can be calibrated in Settings → Script.</p>
<p>Templates: Indian Standard (A4, default), Hollywood Standard (US Letter), TV One-Hour, TV Half-Hour Multicam and Stage Play. Format → Page Format &amp; Templates lets you adjust and save your own.</p>`,
  },
  {
    id: 'story',
    title: '7. Story tools',
    img: 'cards.png',
    html: `<ul><li><b>Navigator</b> (left): every scene with number, page, length and synopsis. Drag to reorder.</li>
<li><b>Index Cards</b>: one card per scene; drag to rearrange — the script follows.</li>
<li><b>Beat Board</b>: a free canvas for ideas and images before you write. "→ Outline" turns a beat into a scene.</li>
<li><b>Outline</b>: acts and the interval, with page counts per act.</li>
<li><b>Story Tracks</b>: tag scenes as A/B/C plotlines (Scene panel on the right) and see where each track appears.</li>
<li><b>Characters / Locations</b>: built automatically from the script; add photos, age, role, arc and notes.</li>
<li><b>Notes</b>: select text and press ${k('Ctrl+Alt+N')} to add a coloured note.</li></ul>`,
  },
  {
    id: 'commercial',
    title: '8. Commercial cinema tools',
    img: 'pulse.png',
    html: `<ul><li><b>Song</b> (${k('Ctrl+8')}): click ✎ Edit to fill song number, title, situation, mood, singers, lyricist, choreography, location and duration. All songs appear in the Songs report.</li>
<li><b>Interval</b> (${k('Ctrl+Shift+I')}): marks the intermission; first and second half are measured separately everywhere.</li>
<li><b>Fight Block</b> (${k('Ctrl+Shift+F')}): numbered stunt beats, the key mass moment and duration.</li>
<li><b>Montage / Flashback / Dream / Intercut</b> markers (${k('Ctrl+Shift+M')}).</li>
<li><b>Scene tags</b> in the Scene panel: Hero Intro, Mass Moment, Punch Dialogue, Comedy, Emotional Beat, Twist, Romance, Villain Intro.</li>
<li><b>Pulse Chart</b>: the energy of your film minute by minute, with the interval marked and a warning when too long passes without a high point — a scorecard for producers.</li>
<li><b>Punch Library</b>: save your best lines and insert them anywhere.</li></ul>`,
  },
  {
    id: 'production',
    title: '9. Production',
    html: `<ul><li><b>Breakdown tagging</b>: select words (e.g. "speedboat") and choose a category in the Breakdown panel — Cast, Junior Artists, Props, Wardrobe, Makeup, Vehicles, Animals, Stunts, SFX, VFX, Music, Set Dressing, Location.</li>
<li><b>Breakdown sheets</b>, <b>reports</b> (scenes, characters, cast, locations, day/night, INT/EXT, songs, fights, tags) and the <b>One-Liner</b> export to PDF and Excel.</li>
<li><b>Stripboard</b>: drag scene strips into shooting days and export the day-wise schedule.</li></ul>`,
  },
  {
    id: 'revisions',
    title: '10. Revisions and drafts',
    html: `<p><b>Script → Revisions</b> starts a coloured revision (Blue, Pink, Yellow, Green, Goldenrod, Buff, Salmon, Cherry). Changed lines get an asterisk (*) and revised pages can print on the revision colour. Lock pages to create A-pages (12A) and lock scene numbers so new scenes become 12A, 12B. Use <b>Script → Omit Scene</b> to keep a number as OMITTED.</p>
<p><b>Version History</b> keeps automatic snapshots plus named drafts ("Draft 2 – Producer notes"). Compare any two side by side with changes highlighted, and restore any version.</p>
<p>When sending a script out, add a watermark in Export PDF — e.g. "CONFIDENTIAL – Sent to &lt;name&gt; – &lt;date&gt;".</p>`,
  },
  {
    id: 'export',
    title: '11. Import, export and PDF',
    img: 'pdf.png',
    html: `<p>Open Final Draft (.fdx), Fountain, Word (.docx) and plain-text scripts with File → Open. Export to PDF, Final Draft, Fountain, Word, plain text and HTML.</p>
<p>PDFs are produced by the same engine as Google Chrome, so Tamil, Telugu and other Indian scripts print with perfect letter joining. In the browser, choose <b>Save as PDF</b> in the print window.</p>
<p>The <b>Title Page</b> (File menu) holds title, writer, contact, draft, date and your Writers' Association registration number.</p>`,
  },
  {
    id: 'ai',
    title: '12. AI assistant (optional)',
    html: `<p>The AI assistant is switched off until you add your own Anthropic API key in <b>Settings → AI</b>. The key stays on your computer. Before anything is sent you see exactly what will be sent, and nothing changes in your script until you click <b>Accept</b>.</p>
<p>Actions: punch up dialogue, make a scene more commercial/mass, rewrite in another tone, continuity check, scene summaries, logline and synopsis, <b>translate for dubbing</b> into Tamil, Telugu, Hindi, Malayalam, Kannada or English (lip-sync friendly, as a new draft), and cinematic AI image prompts for previz.</p>`,
  },
  {
    id: 'aids',
    title: '13. Writing aids & shortcuts',
    html: `<ul><li><b>Goals</b> panel: daily page or word goal, streaks, sprint timer and session stats.</li>
<li><b>Read Aloud</b> (Tools): hear your scene with a different voice per character, including Indian-language voices if installed.</li>
<li><b>Keyboard Shortcuts</b> (Tools): change any shortcut.</li>
<li><b>Spell check</b>: English, with your own word list for Indian names (Edit → Custom Dictionary).</li>
<li>Switch the interface to <b>தமிழ்</b> or <b>తెలుగు</b> in Settings → General.</li></ul>`,
  },
];

function HelpDialog() {
  const [id, setId] = useState('start');
  const sec = SECTIONS.find((s) => s.id === id)!;
  return (
    <Dialog title="Katha Studio — User Manual" size="wide" footer={<button onClick={() => (store.closeDialog(), runCommand('help.tutorial'))}>🎓 Start the interactive tutorial</button>}>
      <div style="display:grid;grid-template-columns:230px 1fr;gap:16px">
        <div class="col" style="gap:2px">
          {SECTIONS.map((s) => (
            <button key={s.id} class={'ghost' + (s.id === id ? ' on' : '')} style="text-align:left" onClick={() => setId(s.id)}>
              {s.title}
            </button>
          ))}
        </div>
        <div class="help-page">
          <h2>{sec.title}</h2>
          {sec.img && <img src={`./help/${sec.img}`} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
          <div dangerouslySetInnerHTML={{ __html: sec.html }} />
        </div>
      </div>
    </Dialog>
  );
}

lazyDialogs.help = HelpDialog;
