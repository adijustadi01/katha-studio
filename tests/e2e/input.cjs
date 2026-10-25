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
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public static string Popups() {
    var sb = new System.Text.StringBuilder();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var c = new System.Text.StringBuilder(256); GetClassName(h, c, 256);
      RECT r; GetWindowRect(h, out r); uint pid; GetWindowThreadProcessId(h, out pid);
      string pn = ""; try { pn = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch {}
      if (pn.ToLower().Contains("electron") || c.ToString() == "#32768")
        sb.Append(c.ToString() + "|" + pn + "|" + r.L + "," + r.T + "," + (r.R - r.L) + "x" + (r.B - r.T) + ";");
      return true;
    }, IntPtr.Zero);
    return sb.ToString();
  }
}
"@
[KIn]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
$SB = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
function MoveTo($x, $y) { [KIn]::SetCursorPos($x, $y) | Out-Null; [KIn]::mouse_event(0x8001, [uint32][math]::Round($x * 65535 / ($SB.Width - 1)), [uint32][math]::Round($y * 65535 / ($SB.Height - 1)), 0, [IntPtr]::Zero) }
function Shot($p) { $b = [System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height; $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size); $bmp.Save($p); $g.Dispose(); $bmp.Dispose() }
`;
const VK = { Escape: 0x1b, Down: 0x28, Up: 0x26, Left: 0x25, Right: 0x27, Return: 0x0d, F10: 0x79, Alt: 0x12 };

function win(cmds) {
  let ps = PS_PRELUDE;
  for (const c of cmds) {
    // SetCursorPos alone moves the pointer without a mouse-move input event; menus track input events,
    // so also send an absolute move to the same point
    if (c[0] === 'move') ps += `MoveTo ${c[1]} ${c[2]}; Start-Sleep -Milliseconds 40\n`;
    if (c[0] === 'down') ps += `[KIn]::mouse_event(2,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 30\n`;
    if (c[0] === 'up') ps += `[KIn]::mouse_event(4,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 30\n`;
    if (c[0] === 'click') ps += `[KIn]::SetCursorPos(${c[1]}, ${c[2]}) | Out-Null; Start-Sleep -Milliseconds 60; [KIn]::mouse_event(2,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 90; [KIn]::mouse_event(4,0,0,0,[IntPtr]::Zero)\n`;
    if (c[0] === 'sleep') ps += `Start-Sleep -Milliseconds ${c[1]}\n`;
    if (c[0] === 'stamp') ps += `Write-Output ("STAMP ${c[1]} " + [DateTimeOffset]::Now.ToUnixTimeMilliseconds())\n`;
    if (c[0] === 'shot') ps += `Shot '${c[1]}'\n`;
    if (c[0] === 'popups') ps += `Write-Output ("POPUPS ${c[1] || ''} " + [KIn]::Popups())\n`;
    if (c[0] === 'press') ps += `[KIn]::SetCursorPos(${c[1]}, ${c[2]}) | Out-Null; Start-Sleep -Milliseconds 60; [KIn]::mouse_event(2,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds ${c[3]}; [KIn]::mouse_event(4,0,0,0,[IntPtr]::Zero)\n`;
    if (c[0] === 'key') ps += `[KIn]::keybd_event(${VK[c[1]]},0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 40; [KIn]::keybd_event(${VK[c[1]]},0,2,[IntPtr]::Zero); Start-Sleep -Milliseconds 40\n`;
  }
  return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
}

function x11(cmds) {
  // stamps and shots are handled here; the rest goes to the XTEST helper in order
  let out = '';
  let batch = [];
  const flush = () => {
    if (batch.length) execFileSync('python3', [path.join(__dirname, 'xinput.py'), ...batch]);
    batch = [];
  };
  for (const c of cmds) {
    if (c[0] === 'stamp') {
      flush();
      out += `STAMP ${c[1]} ${Date.now()}\n`;
    } else if (c[0] === 'shot') {
      flush();
      try {
        execFileSync('import', ['-window', 'root', c[1]]);
      } catch {}
    } else if (c[0] === 'popups') {
      // not available on X11: menu state comes from Electron events instead
    } else if (c[0] === 'press') {
      batch.push('move', String(c[1]), String(c[2]), 'down', 'sleep', String(c[3]), 'up');
    } else if (c[0] === 'key') {
      batch.push('key', { Alt: 'Alt_L' }[c[1]] || String(c[1]));
    } else batch.push(...c.map(String));
  }
  flush();
  return out;
}

/** Move the pointer in small steps (menus react to motion, not jumps). */
exports.glide = (x0, y0, x1, y1, steps = 8) => {
  const cmds = [];
  for (let i = 1; i <= steps; i++) cmds.push(['move', Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps)]);
  exports.input(cmds);
};

/** Run a list of input commands: ['click', x, y] | ['move', x, y] | ['down'] | ['up'] | ['key', name]. */
exports.input = (cmds) => (process.platform === 'win32' ? win(cmds) : x11(cmds));
