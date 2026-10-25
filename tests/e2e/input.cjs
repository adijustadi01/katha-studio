// Real OS-level mouse/keyboard input for driving native menus.
// Linux: XTEST via tests/e2e/xinput.py (run under Xvfb). Windows: user32 SendInput via PowerShell.
const { execFileSync } = require('child_process');
const path = require('path');

const PS_PRELUDE = `
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class KIn {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[KIn]::SetProcessDPIAware() | Out-Null
`;
const VK = { Escape: 0x1b, Down: 0x28, Up: 0x26, Left: 0x25, Right: 0x27, Return: 0x0d, F10: 0x79, Alt: 0x12 };

function win(cmds) {
  let ps = PS_PRELUDE;
  for (const c of cmds) {
    if (c[0] === 'move') ps += `[KIn]::SetCursorPos(${c[1]}, ${c[2]}) | Out-Null; Start-Sleep -Milliseconds 40\n`;
    if (c[0] === 'down') ps += `[KIn]::mouse_event(2,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 30\n`;
    if (c[0] === 'up') ps += `[KIn]::mouse_event(4,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 30\n`;
    if (c[0] === 'click') ps += `[KIn]::SetCursorPos(${c[1]}, ${c[2]}) | Out-Null; Start-Sleep -Milliseconds 60; [KIn]::mouse_event(2,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 90; [KIn]::mouse_event(4,0,0,0,[IntPtr]::Zero)\n`;
    if (c[0] === 'key') ps += `[KIn]::keybd_event(${VK[c[1]]},0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 40; [KIn]::keybd_event(${VK[c[1]]},0,2,[IntPtr]::Zero); Start-Sleep -Milliseconds 40\n`;
  }
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
}

function x11(cmds) {
  const args = [];
  for (const c of cmds) args.push(...c.map(String));
  execFileSync('python3', [path.join(__dirname, 'xinput.py'), ...args]);
}

/** Move the pointer in small steps (menus react to motion, not jumps). */
exports.glide = (x0, y0, x1, y1, steps = 8) => {
  const cmds = [];
  for (let i = 1; i <= steps; i++) cmds.push(['move', Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps)]);
  exports.input(cmds);
};

/** Run a list of input commands: ['click', x, y] | ['move', x, y] | ['down'] | ['up'] | ['key', name]. */
exports.input = (cmds) => (process.platform === 'win32' ? win(cmds) : x11(cmds));
