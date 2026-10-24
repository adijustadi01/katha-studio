// Mocks api.anthropic.com to verify: no request before "Send", preview shown, review + accept works.
const { chromium } = require('playwright');
const OUT = process.env.OUT || 'shots';
const sse = (text) => {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } }) +
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }) +
    ev('content_block_stop', { index: 0 }) +
    ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 50 } }) +
    ev('message_stop', {});
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let calls = 0; let body = null;
  await page.route('https://api.anthropic.com/**', async (route) => {
    calls++; body = JSON.parse(route.request().postData());
    // return the same scene with one punched-up line
    const user = body.messages[0].content;
    const scene = user.slice(user.indexOf('EXT.'));
    const out = scene.replace("I'm Surya.", "I'm Surya.").replace('நான் சூர்யா. இந்த ஊரோட சூரியன்.', 'நான் சூர்யா. இந்த ஊருக்கே சூரியன் நான்தான்!');
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(out) });
  });
  await page.addInitScript(() => { localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })); localStorage.setItem('katha.secret.anthropic', 'sk-ant-test'); });
  await page.goto(process.env.APP_URL || 'http://localhost:4173/katha-studio/');
  await page.waitForTimeout(800);
  await page.click('text=Open sample screenplay');
  await page.waitForTimeout(1200);
  // put cursor in scene 2
  await page.evaluate(() => { const v = window.__view; let pos = 0; v.state.doc.forEach((n, p) => { if (n.textContent.startsWith('EXT. FISHING')) pos = p + 2; }); v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(pos)))); });
  await page.evaluate(() => window.__runCommand('tools.ai'));
  await page.waitForTimeout(300);
  await page.click('text=Preview what will be sent…');
  await page.waitForTimeout(300);
  const before = calls;
  await page.screenshot({ path: OUT + '/ai-preview.png' });
  await page.click('.rightpanel button.primary:has-text("Send")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: OUT + '/ai-review.png' });
  await page.click('text=✓ Accept');
  await page.waitForTimeout(500);
  const has = await page.evaluate(() => window.__katha.elements().some((e) => e.text.includes('நான்தான்')));
  console.log(JSON.stringify({ callsBeforeSend: before, calls, model: body?.model, fallbacks: body?.fallbacks, effort: body?.output_config, applied: has, errors }));
  await browser.close();
})();
