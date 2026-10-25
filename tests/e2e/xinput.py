# Real X11 mouse/keyboard input through the XTEST extension (for driving native menus under Xvfb).
# usage: python3 xinput.py move X Y | down | up | click X Y | key KEYSYM
import ctypes, sys, time
x11 = ctypes.CDLL('libX11.so.6')
xt = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XStringToKeysym.restype = ctypes.c_ulong
d = x11.XOpenDisplay(None)
if not d:
    sys.exit('no display')
d = ctypes.c_void_p(d)
def flush():
    x11.XFlush(d)
def move(x, y):
    xt.XTestFakeMotionEvent(d, -1, int(x), int(y), 0); flush()
def btn(down):
    xt.XTestFakeButtonEvent(d, 1, 1 if down else 0, 0); flush()
def key(name):
    code = x11.XKeysymToKeycode(d, x11.XStringToKeysym(name.encode()))
    xt.XTestFakeKeyEvent(d, code, 1, 0); flush(); time.sleep(0.03)
    xt.XTestFakeKeyEvent(d, code, 0, 0); flush()
args = sys.argv[1:]
while args:
    c = args.pop(0)
    if c == 'move': move(args.pop(0), args.pop(0))
    elif c == 'down': btn(True)
    elif c == 'up': btn(False)
    elif c == 'click':
        move(args.pop(0), args.pop(0)); time.sleep(0.05); btn(True); time.sleep(0.08); btn(False)
    elif c == 'key': key(args.pop(0))
    elif c == 'sleep': time.sleep(float(args.pop(0)))
    time.sleep(0.02)
