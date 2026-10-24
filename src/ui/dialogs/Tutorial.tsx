import { useEffect, useState } from 'preact/hooks';
import { store } from '../../app/store';
import { prefs } from '../../app/prefs';
import { lazyDialogs } from './lazy';
import { runCommand } from '../../app/commands';

interface Step {
  target?: string; // data-tour selector
  title: string;
  text: string;
  needsProject?: boolean;
}

const STEPS: Step[] = [
  { title: 'வணக்கம் · నమస్కారం · Welcome!', text: 'This 1-minute tour shows you the essentials. We will open the sample screenplay "Theeram" so you can try everything safely.' },
  { target: 'elements', needsProject: true, title: 'Element type', text: 'Every line is an element: Scene Heading, Action, Character, Dialogue… Just press Enter and Tab while writing and Katha picks the right one. Ctrl+1…9 jump to a type.' },
  { target: 'lang', needsProject: true, title: 'Type Tamil & Telugu in English letters', text: 'Choose தமிழ் or తెలుగు and type "vanakkam" or "ela unnav" — the native script appears as you type. Ctrl+Space switches on and off.' },
  { target: 'views', needsProject: true, title: 'Page, Draft and Speed views', text: 'Page View shows exact printed pages with (MORE) and (CONT\'D). Speed View hides page breaks for fast writing.' },
  { target: 'sidebar', needsProject: true, title: 'Navigator, cards & characters', text: 'All your scenes with page and length. Drag to reorder. Tabs give you index cards, characters, locations and notes.' },
  { target: 'right', needsProject: true, title: 'Scene tags, breakdown & AI', text: 'Tag scenes (Hero Intro, Mass Moment, Song…) for the Pulse Chart, tag props and costumes for production, and use the optional AI assistant.' },
  { target: 'status', needsProject: true, title: 'Always know your length', text: 'Page count, runtime, and First Half / Second Half time around the Interval are always visible here.' },
  { target: 'mainview', needsProject: true, title: 'More views', text: 'Index Cards, Beat Board, Outline, Story Tracks, Pulse Chart, Punch Library, Reports and the Stripboard live here.' },
  { title: "You're ready!", text: 'Your work saves automatically. Press Ctrl+S once to choose where your file lives. The full illustrated manual is under Help → User Manual (F1).' },
];

function Tutorial() {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];
  useEffect(() => {
    if (step.needsProject && !store.project) runCommand('file.sample');
    const t = setTimeout(() => {
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    }, step.needsProject && !store.project ? 700 : 80);
    return () => clearTimeout(t);
  }, [i]);
  const finish = () => {
    prefs.tutorialDone = true;
    store.savePrefs();
    store.closeDialog();
  };
  const pos = rect
    ? {
        left: Math.min(window.innerWidth - 380, Math.max(10, rect.left)) + 'px',
        top: (rect.bottom + 240 < window.innerHeight ? rect.bottom + 12 : Math.max(10, rect.top - 220)) + 'px',
      }
    : { left: 'calc(50% - 180px)', top: '30%' };
  return (
    <>
      {rect ? (
        <div class="tutorial-spot" style={{ left: rect.left - 6 + 'px', top: rect.top - 6 + 'px', width: rect.width + 12 + 'px', height: rect.height + 12 + 'px' }} />
      ) : (
        <div class="tutorial-spot" style={{ left: '50%', top: '50%', width: '0', height: '0' }} />
      )}
      <div class="tutorial" style={pos} role="dialog">
        <div class="small muted">
          Step {i + 1} of {STEPS.length}
        </div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div class="row">
          <button class="ghost" onClick={finish}>
            Skip
          </button>
          <span style="flex:1" />
          {i > 0 && <button onClick={() => setI(i - 1)}>Back</button>}
          {i < STEPS.length - 1 ? (
            <button class="primary" onClick={() => setI(i + 1)}>
              Next
            </button>
          ) : (
            <button class="primary" onClick={finish}>
              Start writing
            </button>
          )}
        </div>
      </div>
    </>
  );
}

lazyDialogs.tutorial = Tutorial;
