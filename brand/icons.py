import sys; sys.path.insert(0, '.')
from make_logos import text_path, measure, ink_box, stripe, PRIDE, INK, PINK, SUN, WHITE
CREAM = '#F6F2E9'
def amp(size, cx, cy, fill):
    w = measure('&', size); cap = ink_box('&', size)
    return f'<path d="{text_path("&", size, cx - w/2, cy + cap/2)}" fill="{fill}"/>'
def tile(bg, r=22): return f'<rect width="100" height="100" rx="{r}" fill="{bg}"/>'
O = {}
O['1'] = ('Pink tile, white &, stripe', tile(PINK) + amp(66, 50, 44, WHITE) + stripe(22, 80, 56, 7, PRIDE))
O['2'] = ('Charcoal tile, pink &, stripe', tile(INK) + amp(66, 50, 44, PINK) + stripe(22, 80, 56, 7, PRIDE))
O['3'] = ('Pride-stripe tile, white &', '<clipPath id="t3"><rect width="100" height="100" rx="22"/></clipPath><g clip-path="url(#t3)">' + ''.join(f'<rect y="{i*100/6:.2f}" width="100" height="{100/6+0.2:.2f}" fill="{c}"/>' for i, c in enumerate(PRIDE)) + '</g>' + amp(72, 50, 50, WHITE))
O['4'] = ('Rainbow-filled & on cream', tile(CREAM) + '<clipPath id="a4">' + amp(84, 50, 50, '#000').replace('fill="#000"', '') + '</clipPath><g clip-path="url(#a4)">' + ''.join(f'<rect y="{8+i*14:.1f}" width="100" height="14.2" fill="{c}"/>' for i, c in enumerate(PRIDE)) + '</g>')
O['5'] = ('Pink circle, white &', f'<circle cx="50" cy="50" r="50" fill="{PINK}"/>' + amp(70, 50, 48, WHITE) + stripe(30, 78, 40, 6, PRIDE))
O['6'] = ('Sunflower tile, charcoal &', tile(SUN) + amp(66, 50, 44, INK) + stripe(22, 80, 56, 7, PRIDE))
oa = lambda fill: f'<path d="{text_path("OA", 46, 50 - measure("OA", 46, -2)/2, 50 + ink_box("OA", 46)/2 - 4, -2)}" fill="{fill}"/>'
O['7'] = ('OA initials, pink tile', tile(PINK) + oa(WHITE) + stripe(18, 78, 64, 7, PRIDE))
O['8'] = ('Charcoal & with stripe (no tile)', amp(84, 50, 42, INK) + stripe(14, 84, 72, 9, PRIDE))
import os; os.makedirs('icon-options', exist_ok=True)
for k, (n, body) in O.items():
    open(f'icon-options/icon-{k}.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{body}</svg>')
rows = ''
for k, (n, body) in O.items():
    s = f'<svg viewBox="0 0 100 100">{body}</svg>'
    sz = lambda w: s.replace('<svg ', f'<svg width="{w}" height="{w}" ', 1)
    tab = lambda dark: f'''<div class="bar {'dark' if dark else ''}"><div class="tab">{sz(16)}<span>Out and About Books</span><i>×</i></div><div class="tab off"><span>New tab</span></div></div>'''
    rows += f'''<div class="row"><h2>{k} · {n}</h2><div class="cells">
      <div class="c">{sz(120)}</div><div class="c">{sz(64)}{sz(32)}{sz(16)}</div>
      <div class="c col">{tab(False)}{tab(True)}</div>
      <div class="c phone"><div class="app">{sz(60)}<small>O&amp;A Books</small></div></div></div></div>'''
A = '/home/claude/oab/src/assets/fonts'
open('icon-sheet.html', 'w').write(f'''<!doctype html><style>
@font-face{{font-family:Poppins;src:url(file://{A}/Poppins-Bold.woff);font-weight:700}}
@font-face{{font-family:Poppins;src:url(file://{A}/Poppins-Medium.woff);font-weight:500}}
body{{margin:0;padding:24px;font-family:Poppins;color:{INK};width:1180px;background:#fff}}
.row{{border-top:1px solid #ddd;padding:14px 0}} h2{{font-size:19px;margin:0 0 10px}}
.cells{{display:grid;grid-template-columns:170px 220px 420px 170px;gap:14px}}
.c{{background:{CREAM};border-radius:12px;height:150px;display:flex;align-items:center;justify-content:center;gap:16px}}
.col{{flex-direction:column;gap:10px;background:#fff;border:1px solid #eee}}
.bar{{width:380px;background:#DEE1E6;border-radius:8px 8px 0 0;padding:6px 6px 0;display:flex;gap:4px}} .bar.dark{{background:#202124}}
.tab{{background:#fff;border-radius:8px 8px 0 0;padding:7px 10px;display:flex;align-items:center;gap:8px;font:500 12px system-ui;width:190px}}
.bar.dark .tab{{background:#35363A;color:#eee}} .tab i{{margin-left:auto;font-style:normal;opacity:.6}} .tab.off{{background:transparent;width:auto;color:#555}}
.phone{{background:linear-gradient(160deg,#3b4a6b,#6b4a7a)}} .app{{display:flex;flex-direction:column;align-items:center;gap:6px;color:#fff;font:500 11px system-ui}} .app svg{{border-radius:14px}}
</style>{rows}''')
