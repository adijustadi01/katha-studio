// "THEERAM" (The Shore) — an original sample screenplay written for Katha Studio.
// Set on the Pulicat lake at the Tamil Nadu / Andhra Pradesh border, it mixes
// Tamil and Telugu dialogue and exercises every feature: bilingual dialogue,
// a song, the interval, a fight block, dual dialogue, tags, tracks and notes.
import type { Project, ScriptElement, ElementType } from './types';
import { newProject, uid } from './project';

export function sampleProject(): Project {
  const els: ScriptElement[] = [];
  const add = (type: ElementType, text: string, extra: Partial<ScriptElement> = {}) => {
    const e: ScriptElement = { id: uid(), type, text, ...extra };
    els.push(e);
    return e;
  };
  const say = (who: string, line: string, meaning?: string, paren?: string, extra: Partial<ScriptElement> = {}) => {
    add('character', who, extra.dual ? { dual: extra.dual } : {});
    if (paren) add('parenthetical', `(${paren})`, extra.dual ? { dual: extra.dual } : {});
    add('dialogue', line, { ...(meaning ? { meaning } : {}), ...(extra.dual ? { dual: extra.dual } : {}) });
  };

  add('transition', 'FADE IN:');
  // 1
  const s1 = add('scene', 'EXT. PULICAT LAKE - DAWN');
  add('action', 'Mist rolls over the vast, silver lake. A line of wooden boats drifts home. Somewhere a temple bell rings across the water — on one shore Tamil Nadu, on the other Andhra Pradesh.');
  add('action', 'A speedboat SLAMS through the mist, scattering the fishing boats. BHAIRAVA (50s, white silk, gold rings, calm as a crocodile) stands at the bow. His GOONS leap into an old fisherman\'s boat and toss his catch into their crates.');
  say('OLD FISHERMAN', 'అయ్యా, ఇది నా పిల్లల అన్నం!', 'Sir, this is my children\'s food!', 'pleading');
  say('BHAIRAVA', 'ఈ సరస్సులో ప్రతి చేప మీద నా పేరు రాసి ఉంది.', 'Every fish in this lake has my name written on it.');
  add('action', 'He flicks a coin into the water. The goons laugh.');
  add('transition', 'CUT TO:');
  // 2
  const s2 = add('scene', 'EXT. FISHING HARBOUR - DAY');
  add('action', 'Chaos at the harbour. Bhairava\'s goons are loading seized crates onto a truck. Fishermen watch, helpless.');
  add('action', 'A lone boat cuts through the shimmering heat. At its stern, silhouetted against the sun: SURYA (30), fisherman, shirt knotted at the waist, a coil of rope over his shoulder.');
  add('action', 'The boat glides in. Surya steps onto the jetty. Slow motion. The crowd parts. The drums kick in.');
  say('GOON 1', 'ఎవడ్రా నువ్వు?', 'Who the hell are you?');
  say('SURYA', 'நான் சூர்யா. இந்த ஊரோட சூரியன்.', "I'm Surya. This village's sun.");
  add('action', 'Goon 1 swings a crowbar. Surya catches it bare-handed without looking.');
  say('SURYA', 'கடல் யாருக்கும் சொந்தம் இல்ல. ஆனா இந்த கரை எங்க அம்மா மாதிரி. தொட்டா, திருப்பி அடிக்கும்.', 'The sea belongs to no one. But this shore is like my mother. Touch it, and it hits back.', 'calm');
  add('action', 'He yanks the crowbar. The goon flies into the stacked crates. Fish rain down. The fishermen ROAR.');
  // 3
  const s3 = add('scene', "INT. SURYA'S HOUSE - NIGHT");
  add('action', 'A small tiled house. A kerosene lamp. AMMA (60) serves rice onto a banana leaf. A garlanded photo of Surya\'s FATHER watches from the wall.');
  say('AMMA', 'சாப்டியா கண்ணா?', 'Did you eat, my dear?');
  say('SURYA', 'நீ சாப்டியா மா?', 'Did you eat, Amma?');
  add('action', 'She doesn\'t answer. She looks at the photograph.');
  say('AMMA', 'உங்க அப்பா போன அன்னிக்கும் இதே கடல் தான்... இதே அமைதி தான்.', 'The day your father left, it was the same sea... the same silence.');
  say('SURYA', 'அப்பா பாதியில விட்டுப்போனதை நான் முடிச்சு வைக்கிறேன்.', 'What Appa left half-done, I will finish.');
  // 4
  const s4 = add('scene', 'EXT. BORDER MARKET - DAY');
  add('action', 'A bustling fish market straddling the state border. A painted signboard reads "TAMIL NADU" on one side and "ANDHRA PRADESH" on the other.');
  add('action', 'MUTHU (28, Surya\'s best friend, chronic talker) haggles badly. Surya reaches for a basket of prawns — and so does LAKSHMI (25, sharp, fearless, Telugu).');
  say('LAKSHMI', 'ఏయ్! నా చేపలు ఎందుకు తీసుకుంటున్నావ్?', 'Hey! Why are you taking my fish?');
  say('MUTHU', 'அண்ணா, இந்த பொண்ணு என்ன சொல்லுது?', "Brother, what's this girl saying?", 'whispering');
  say('SURYA', 'క్షమించండి.', 'Sorry.');
  say('LAKSHMI', 'తమిళం వాళ్ళకి తెలుగు కూడా వచ్చా?', 'You Tamil people know Telugu too?', 'surprised');
  say('SURYA', 'కొంచెం. కానీ మీ కళ్ళు మాట్లాడేది పూర్తిగా అర్థమవుతుంది.', 'A little. But what your eyes say, I understand completely.');
  add('action', "Muthu and Lakshmi's friend PADMA (24) exchange a look of pure despair.");
  say('MUTHU', 'அய்யோ, ஆரம்பிச்சுட்டான்!', "Oh no, he's started!", undefined, { dual: 'left' });
  say('PADMA', 'అయ్యో, మొదలుపెట్టాడు!', "Oh no, he's started!", undefined, { dual: 'right' });
  // song
  add('song', 'Surya and Lakshmi on two boats on either side of the border buoys. The song moves from Tamil to Telugu verse by verse, ending with both boats tied together.', {
    song: {
      number: 1,
      title: 'Rendu Karai (Two Shores)',
      situation: 'First love across the border — each sings in their own language, meeting in the chorus.',
      mood: 'Romantic, playful',
      singers: 'Male (Tamil) & Female (Telugu)',
      lyricist: 'TBD',
      choreography: 'Boat formations, 60 dancers, sunset light, lantern finale',
      location: 'Pulicat lake, Sriharikota side',
      duration: '4:30',
    },
  });
  // 5
  const s5 = add('scene', 'EXT. LAKE ISLAND - NIGHT');
  add('action', 'Moonlight. Surya rows silently toward a tiny island. Torches flicker between the casuarina trees.');
  add('action', "He crouches behind a broken boat. Bhairava's men load sealed crates onto a trawler. Among them, carrying the heaviest crate: RAVI (27) — Lakshmi's brother.");
  say('RAVI', 'అన్నా, ఇది ఆఖరి సారి. ఆ తర్వాత నేను బయటకి వచ్చేస్తా.', "Anna, this is the last time. After that, I'm out.");
  say('BHAIRAVA', 'నా దగ్గర ఆఖరి సారి అనేది ఉండదు రా.', "With me, there's no such thing as a last time.");
  add('action', 'Surya\'s jaw tightens. A crate cracks open — not fish. Red sandalwood logs, stamped with forest department seals.');
  // 6
  const s6 = add('scene', 'EXT. JETTY - NIGHT');
  add('action', 'Flames. Five fishing boats burn on the water. The village stands frozen. Bhairava walks down the jetty, lit by the fire.');
  say('BHAIRAVA', 'ఈ సరస్సు నాది. నీళ్ళు, చేపలు, మనుషులు... అన్నీ నావే.', 'This lake is mine. The water, the fish, the people... all of it is mine.');
  add('action', 'Surya steps out of the crowd and walks straight into the fire-light. He stops one foot from Bhairava.');
  say('SURYA', 'தண்ணிக்கு எல்லை கிடையாது பைரவா. ஆனா என் பொறுமைக்கு இருக்கு.', 'Water has no border, Bhairava. But my patience does.');
  add('action', 'Behind Surya, one by one, the fishermen of BOTH shores step forward. Bhairava\'s smile falters.');
  add('interval', 'INTERVAL');
  // 7
  const s7 = add('scene', 'EXT. SALT PANS - DAY');
  add('action', 'Blinding white salt pans to the horizon. Bhairava\'s jeeps encircle Surya, who stands alone with a fishing net.');
  add('fight', 'Surya uses the fishing net and the slippery salt as weapons. Real-location stunts; no wires except beat 4.', {
    fight: {
      number: 1,
      setting: 'Salt pans, noon',
      beats: [
        'Jeeps circle; dust and salt explode around Surya.',
        'Surya throws the net over the first jeep\'s windshield — it flips into the brine.',
        'Six goons charge; Surya fights in waist-deep brine, using the salt rake.',
        'Mass moment: Surya pulls the trawler rope, dragging two goons across the pans.',
        'Ravi arrives — and turns on Bhairava\'s men.',
      ],
      massMoment: 'Surya walks out of a salt storm, net over shoulder, as the drums peak',
      duration: '6:00',
    },
  });
  // 8
  const s8 = add('scene', "INT. LAKSHMI'S HOUSE - DAY");
  add('action', 'Lakshmi cleans a wound on Ravi\'s arm. Neither speaks. A photo of their late MOTHER on the shelf.');
  say('LAKSHMI', 'అన్నయ్యా, అమ్మ ఉంటే ఇది చూసి ఏమనేది?', 'Brother, if Amma were alive, what would she say seeing this?');
  say('RAVI', 'నన్ను క్షమించు చెల్లీ.', 'Forgive me, little sister.', 'breaking');
  add('action', 'She pulls him into a hug. Through the window, Surya watches — and walks away quietly.');
  // 9
  const s9 = add('scene', 'EXT. PULICAT LAKE - DAWN');
  add('action', 'The same mist as the opening. But now the boats of both shores sail together. Bhairava, handcuffed, sits in a police boat.');
  say('SURYA', 'இந்த கரை ரெண்டு மொழி பேசும். ஆனா ஒரே இதயம்.', 'This shore speaks two languages. But one heart.');
  add('action', 'Lakshmi\'s boat bumps against his. She smiles. The sun rises over the border buoys.');
  add('transition', 'FADE OUT.');

  const p = newProject(els);
  p.titlePage = {
    title: 'THEERAM (The Shore)',
    credit: 'Written by',
    author: 'Katha Studio Sample',
    basedOn: 'An original story',
    contact: 'writer@example.com\n+91 00000 00000',
    draft: 'Draft 1',
    date: '24-10-2026',
    registration: 'Writers\' Assn. Reg. No. SAMPLE-0001',
    notes: '',
  };
  p.settings.sceneNumbers = 'both';
  p.settings.layers = { roman: true, meaning: true };
  p.settings.exportLayers = { roman: true, meaning: true };
  const sc = (e: ScriptElement, color: string, synopsis: string, tags: string[], tracks: string[]) =>
    (p.scenes[e.id] = { color, synopsis, tags, tracks, title: e.text.replace(/^(INT|EXT)\.\s*/, '') });
  sc(s1, '#90a4ae', 'Bhairava seizes the fishermen\'s catch — the lake is under his thumb.', ['villain-intro'], ['A']);
  sc(s2, '#ff7043', 'Surya arrives and humiliates Bhairava\'s goons at the harbour.', ['hero-intro', 'mass', 'punch'], ['A']);
  sc(s3, '#5c6bc0', 'Amma remembers Surya\'s father; Surya vows to finish his fight.', ['emotional'], ['A']);
  sc(s4, '#f06292', 'Surya meets Lakshmi in a language mix-up at the border market.', ['comedy', 'romance'], ['B']);
  sc(s5, '#7e57c2', 'Surya discovers Lakshmi\'s brother Ravi smuggling red sandalwood for Bhairava.', ['twist'], ['A', 'C']);
  sc(s6, '#e53935', 'Bhairava burns the boats; Surya and both villages stand up to him.', ['mass', 'punch'], ['A']);
  sc(s7, '#ffb300', 'The salt-pan fight. Ravi switches sides.', ['mass'], ['A', 'C']);
  sc(s8, '#26a69a', 'Lakshmi forgives Ravi.', ['emotional'], ['C', 'B']);
  sc(s9, '#43a047', 'Both shores sail together. Bhairava is arrested.', ['emotional', 'romance'], ['A', 'B']);
  p.tracks = [
    { id: 'A', name: 'A — Surya vs Bhairava', color: '#e53935' },
    { id: 'B', name: 'B — Surya & Lakshmi', color: '#ec407a' },
    { id: 'C', name: 'C — Ravi\'s redemption', color: '#43a047' },
  ];
  p.characters = {
    SURYA: { name: 'SURYA', age: '30', role: 'Hero — fisherman', arc: 'From protecting his mother to uniting two shores.', relationships: 'Son of Amma; loves Lakshmi; best friend Muthu.', notes: 'Speaks Tamil, some Telugu.' },
    LAKSHMI: { name: 'LAKSHMI', age: '25', role: 'Heroine', arc: 'Fearless trader who saves her brother.', relationships: 'Sister of Ravi.', notes: 'Telugu.' },
    BHAIRAVA: { name: 'BHAIRAVA', age: '50s', role: 'Villain — lake mafia', arc: 'Absolute control → arrested.', relationships: 'Uses Ravi.', notes: 'Telugu. Never raises his voice.' },
    AMMA: { name: 'AMMA', age: '60', role: "Surya's mother", notes: 'Tamil.' },
    MUTHU: { name: 'MUTHU', age: '28', role: 'Comedy sidekick', notes: 'Tamil.' },
    RAVI: { name: 'RAVI', age: '27', role: "Lakshmi's brother", arc: 'Smuggler → redeemed.', notes: 'Telugu.' },
  };
  p.locations = {
    'PULICAT LAKE': { name: 'PULICAT LAKE', notes: 'Second largest brackish lagoon in India; shoot at dawn for mist.' },
    'SALT PANS': { name: 'SALT PANS', notes: 'Marakkanam salt pans as alternative.' },
  };
  p.notes = [
    { id: 'n1', author: 'Producer', color: '#ffd54f', text: 'Hero entry: drone shot + slow motion. Keep under 90 seconds.', created: Date.now(), elementId: s2.id },
    { id: 'n2', author: 'Director', color: '#81d4fa', text: 'Fire on water needs VFX support — check budget.', created: Date.now(), elementId: s6.id },
  ];
  p.punches = [
    { id: 'pu1', text: 'கடல் யாருக்கும் சொந்தம் இல்ல. ஆனா இந்த கரை எங்க அம்மா மாதிரி. தொட்டா, திருப்பி அடிக்கும்.', character: 'SURYA', tags: ['mass', 'hero'], lang: 'ta' },
    { id: 'pu2', text: 'నా దగ్గర ఆఖరి సారి అనేది ఉండదు రా.', character: 'BHAIRAVA', tags: ['villain'], lang: 'te' },
    { id: 'pu3', text: 'தண்ணிக்கு எல்லை கிடையாது பைரவா. ஆனா என் பொறுமைக்கு இருக்கு.', character: 'SURYA', tags: ['interval', 'mass'], lang: 'ta' },
  ];
  // breakdown tags (text references)
  p.breakdown = [
    { id: 'b1', category: 'vehicles', text: 'speedboat', elementId: els[2].id },
    { id: 'b2', category: 'props', text: 'crates', elementId: els[2].id },
    { id: 'b3', category: 'stunts', text: 'catches it bare-handed', elementId: '' },
    { id: 'b4', category: 'vfx', text: 'Five fishing boats burn', elementId: '' },
  ];
  // link tags to their elements by searching the text
  for (const b of p.breakdown) {
    const host = els.find((e) => e.text.includes(b.text));
    if (host) {
      b.elementId = host.id;
      const from = host.text.indexOf(b.text);
      host.spans = [...(host.spans || []), { from, to: from + b.text.length, kind: 'tag', ref: `${b.category}:${b.id}` }];
    }
  }
  // inline note marks
  const n1host = els[els.indexOf(s2) + 2];
  n1host.spans = [...(n1host.spans || []), { from: 0, to: 22, kind: 'note', ref: 'n1' }];
  p.notes[0].elementId = n1host.id;
  p.beats = [
    { id: 'bt1', text: 'Opening: villain owns the lake', x: 40, y: 40, color: '#90a4ae' },
    { id: 'bt2', text: 'Hero entry at harbour — mass', x: 260, y: 40, color: '#ff7043' },
    { id: 'bt3', text: 'Meet-cute across language barrier', x: 480, y: 40, color: '#f06292' },
    { id: 'bt4', text: 'Interval: boats burn, both villages unite', x: 40, y: 200, color: '#e53935' },
    { id: 'bt5', text: 'Climax idea: storm on the lake?', x: 260, y: 200, color: '#ffb300' },
  ];
  return p;
}
