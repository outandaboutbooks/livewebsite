"""Builds the Out and About Books logo files with the lettering converted to outlines,
so they print identically everywhere without needing the font installed."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import os, sys
FONT = TTFont('/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf')
GS = FONT.getGlyphSet(); CMAP = FONT.getBestCmap(); UPM = FONT['head'].unitsPerEm; HM = FONT['hmtx']
PRIDE = ['#E40303', '#FF8C00', '#FFD200', '#008026', '#24408E', '#732982']
INK, PINK, SUN, WHITE = '#2B2F3A', '#D11F6B', '#F7C948', '#FFFFFF'

def measure(text, size, track=0):
    w = sum(HM[CMAP[ord(c)]][0] for c in text) * size / UPM
    return w + track * (len(text) - 1)

def text_path(text, size, x, baseline, track=0):
    s = size / UPM; pen = SVGPathPen(GS); cx = x
    for c in text:
        g = CMAP[ord(c)]
        tp = TransformPen(pen, (s, 0, 0, -s, cx, baseline))
        GS[g].draw(tp)
        cx += HM[g][0] * s + track
    return pen.getCommands()

def ink_box(text, size):  # cap height for layout
    return FONT['OS/2'].sCapHeight * size / UPM

def stripe(x, y, w, h, colours):
    seg = w / len(colours)
    return ''.join(f'<rect x="{x + i*seg:.2f}" y="{y:.2f}" width="{seg + 0.05:.2f}" height="{h:.2f}" fill="{c}"/>' for i, c in enumerate(colours))

def stacked(main, amp, stripe_cols, books=None):
    """B: OUT / & / ABOUT with the Pride stripe under ABOUT (optionally BOOKS under that)."""
    pad = 4; track = -1.4
    s_about = 30; w_about = measure('ABOUT', s_about, track)
    s_out = 36; w_out = measure('OUT', s_out, track)
    W = max(w_about, w_out) + pad * 2; cxm = W / 2
    cap_out = ink_box('OUT', s_out); cap_about = ink_box('ABOUT', s_about)
    y_out = pad + cap_out
    s_amp = 18; y_amp = y_out + 18
    y_about = y_amp + 4 + cap_about
    y_stripe = y_about + 4.5; h_stripe = 4.2
    H = y_stripe + h_stripe + pad
    parts = [
        f'<path d="{text_path("OUT", s_out, cxm - w_out/2, y_out, track)}" fill="{main}"/>',
        f'<path d="{text_path("&", s_amp, cxm - measure("&", s_amp)/2, y_amp)}" fill="{amp}"/>',
        f'<path d="{text_path("ABOUT", s_about, cxm - w_about/2, y_about, track)}" fill="{main}"/>',
        stripe(cxm - w_about/2, y_stripe, w_about, h_stripe, stripe_cols),
    ]
    if books:
        s_b = 11.5; tr_b = 2.2; w_b = measure('BOOKS', s_b, tr_b)
        y_b = y_stripe + h_stripe + 4 + ink_box('BOOKS', s_b)
        parts.append(f'<path d="{text_path("BOOKS", s_b, cxm - w_b/2, y_b, tr_b)}" fill="{books}"/>')
        H = y_b + pad
    return W, H, ''.join(parts)

def slogan(main, accent, stripe_cols):
    """E: Out. / About. / Unapologetic. with the Pride stripe."""
    pad = 4; track = -1
    s1 = 26; w_about = measure('About.', s1, track)
    s3 = s1 * w_about / measure('Unapologetic.', s1, -0.6) ; w3 = measure('Unapologetic.', s3, -0.6)
    cap1 = ink_box('Out.', s1); cap3 = ink_box('U', s3)
    y1 = pad + cap1; y2 = y1 + s1 * 0.98; y3 = y2 + s3 * 1.2
    y_s = y3 + 5; h_s = 4.2
    W = max(w_about, w3) + pad * 2; H = y_s + h_s + pad
    parts = [
        f'<path d="{text_path("Out.", s1, pad, y1, track)}" fill="{main}"/>',
        f'<path d="{text_path("About.", s1, pad, y2, track)}" fill="{main}"/>',
        f'<path d="{text_path("Unapologetic.", s3, pad, y3, -0.6)}" fill="{accent}"/>',
        stripe(pad, y_s, w3, h_s, stripe_cols),
    ]
    return W, H, ''.join(parts)

def icon_oa(bg, fg, stripe_cols):
    """The chosen icon: OA initials on a rounded square, with the Pride stripe."""
    return 100, 100, (f'<rect width="100" height="100" rx="22" fill="{bg}"/>'
            f'<path d="{text_path("OA", 46, 50 - measure("OA", 46, -2)/2, 50 + ink_box("OA", 46)/2 - 4, -2)}" fill="{fg}"/>' + stripe(18, 78, 64, 7, stripe_cols))

def icon(bg, fg, stripe_cols):
    """Square icon for the browser tab, phone home screens and social media."""
    s = 64; w = measure('&', s)
    cap = ink_box('&', s)
    y = 50 + cap / 2 - 6
    return 100, 100, (f'<rect width="100" height="100" rx="22" fill="{bg}"/>'
            f'<path d="{text_path("&", s, 50 - w/2, y)}" fill="{fg}"/>' + stripe(22, 80, 56, 6, stripe_cols))

def save(name, W, H, body, out):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" role="img" aria-label="Out and About Books">{body}</svg>'
    open(os.path.join(out, name + '.svg'), 'w').write(svg)
    return svg

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'logos'
    os.makedirs(out, exist_ok=True)
    one = lambda c: [c] * 6
    save('logo-stacked-colour', *stacked(INK, PINK, PRIDE), out)
    save('logo-stacked-white', *stacked(WHITE, SUN, PRIDE), out)
    save('logo-stacked-black', *stacked('#000000', '#000000', one('#000000')), out)
    save('logo-stacked-books-colour', *stacked(INK, PINK, PRIDE, books=INK), out)
    save('logo-stacked-books-white', *stacked(WHITE, SUN, PRIDE, books=WHITE), out)
    save('logo-stacked-books-black', *stacked('#000000', '#000000', one('#000000'), books='#000000'), out)
    save('slogan-colour', *slogan(INK, PINK, PRIDE), out)
    save('slogan-white', *slogan(WHITE, SUN, PRIDE), out)
    save('slogan-black', *slogan('#000000', '#000000', one('#000000')), out)
    save('icon-oa-pink', *icon_oa(PINK, WHITE, PRIDE), out)
    save('icon-oa-charcoal', *icon_oa(INK, WHITE, PRIDE), out)
    print('done')
