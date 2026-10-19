---
name: ExhibitAR
description: A green self-healing cutting mat in the hero, and below it a sheet of paper taped to the mat with everything printed on it in ink, all measured at one scale.
colors:
  mat-green: '#2d6a4f'
  mat-deep: '#255a42'
  line-cream: '#e9e5c4'
  line-major: 'rgb(233 229 196 / 0.42)'
  line-minor: 'rgb(233 229 196 / 0.15)'
  label-yellow: '#ffc400'
  sheet: '#f6f5ef'
  plate: '#ffffff'
  paper: '#fbfbf8'
  masking-cream: 'rgb(238 230 198 / 0.86)'
  ink: '#141414'
  ink-soft: '#45463f'
  ink-major: 'rgb(20 20 20 / 0.3)'
  ink-minor: 'rgb(20 20 20 / 0.1)'
  text-white: '#ffffff'
  text-soft: '#d5e6da'
typography:
  display:
    fontFamily: 'Barlow Condensed, sans-serif'
    fontSize: 'clamp(3.1rem, 1.5rem + 5.4vw, 6rem)'
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: '-0.012em'
  display-ja:
    fontFamily: 'M PLUS 1, Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, sans-serif'
    fontSize: 'clamp(2.3rem, 1.3rem + 3.6vw, 4.5rem)'
    fontWeight: 800
    lineHeight: 1.16
    letterSpacing: '0'
    fontFeature: "'palt'"
  headline:
    fontFamily: 'Barlow Condensed, sans-serif'
    fontSize: 'clamp(2.5rem, 1.5rem + 3.4vw, 4.5rem)'
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: '-0.005em'
  headline-ja:
    fontFamily: 'M PLUS 1, Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, sans-serif'
    fontSize: 'clamp(1.9rem, 1.2rem + 2.4vw, 3.25rem)'
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: '0'
    fontFeature: "'palt'"
  statement:
    fontFamily: 'Barlow Condensed, sans-serif'
    fontSize: 'clamp(2rem, 1.2rem + 2.8vw, 3.75rem)'
    fontWeight: 700
    lineHeight: 1.04
  numeral:
    fontFamily: 'Barlow Condensed, sans-serif'
    fontSize: 'clamp(4rem, 3rem + 3vw, 6rem)'
    fontWeight: 800
    lineHeight: 0.78
    fontFeature: "'tnum'"
  title:
    fontFamily: 'Barlow Condensed, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 700
    lineHeight: 1.05
  title-sm:
    fontFamily: 'Barlow Condensed, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: 'Barlow, system-ui, sans-serif'
    fontSize: '1.0625rem'
    fontWeight: 400
    lineHeight: 1.55
  body-ja:
    fontFamily: 'Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, Noto Sans CJK JP, Yu Gothic, Meiryo, sans-serif'
    fontSize: '1.0625rem'
    fontWeight: 400
    lineHeight: 1.85
  lede:
    fontFamily: 'Barlow, system-ui, sans-serif'
    fontSize: 'clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)'
    fontWeight: 400
    lineHeight: 1.55
  small:
    fontFamily: 'Barlow, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.55
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: '0.85em'
  label-tape:
    fontFamily: 'Barlow Condensed, sans-serif'
    fontSize: '1.375rem'
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '0.01em'
  label-dimension:
    fontFamily: 'Barlow Condensed, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0.04em'
rounded:
  none: '0px'
spacing:
  cm: '1cm'
  ruler-compact: '0.75cm'
  ruler: '1cm'
  pad-compact: '0.6cm'
  pad: '1cm'
  pad-wide: '2cm'
  gap: '24px'
  section: '2.5cm'
  statement: '3cm'
components:
  button-tape:
    backgroundColor: '{colors.label-yellow}'
    textColor: '{colors.ink}'
    typography: '{typography.label-tape}'
    rounded: '{rounded.none}'
    padding: '15px 30px 15px 28px'
  link-text:
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    padding: '4px 0'
  link-text-mat:
    textColor: '{colors.text-white}'
    typography: '{typography.body}'
    padding: '4px 0'
  button-outline:
    textColor: '{colors.text-white}'
    rounded: '{rounded.none}'
    padding: '7px 14px'
  lang-switch-option:
    textColor: '{colors.text-soft}'
    rounded: '{rounded.none}'
    padding: '5px 10px'
  lang-switch-option-active:
    backgroundColor: '{colors.line-cream}'
    textColor: '{colors.mat-deep}'
    rounded: '{rounded.none}'
    padding: '5px 10px'
  hero-print:
    backgroundColor: '{colors.paper}'
    rounded: '{rounded.none}'
    padding: '10px'
    width: '470px'
  plate:
    backgroundColor: '{colors.plate}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
  qr-card:
    backgroundColor: '{colors.plate}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '14px 22px 14px 14px'
  masking-strip:
    backgroundColor: '{colors.masking-cream}'
    width: '92px'
    height: '26px'
  edge-strip:
    backgroundColor: '{colors.masking-cream}'
    width: '112px'
    height: '28px'
  ruler:
    backgroundColor: '{colors.mat-deep}'
    textColor: '{colors.line-cream}'
    width: '{spacing.ruler}'
  ruler-paper:
    textColor: '{colors.ink}'
    width: '{spacing.ruler}'
---

# Design System: ExhibitAR

## Overview

**Creative North Star: "The Cutting Mat"**

The page is the exhibitor's workbench seen from above. The hero is the green self-healing cutting mat: a printed 1 cm grid with heavier 5 cm lines, centimetre rulers along the top and left edges in cream, and the AR photo lying on it as a taped print. Below the hero, a sheet of warm off-white paper lies on the mat, its top edge taped down with two masking strips, and everything after that point is printed on the paper in ink: type, hairline rules, a 45° and 60° guide, and white plates holding the Studio screenshots and the demo mat inside printer's crop marks. The left ruler keeps counting down the paper, now printed in ink, without a break in the count. The world is calm, exact and physical rather than glossy or techy.

There is one loud colour, borrowed from the product. Label yellow is the colour of the AR labels on the visitor's phone and in the Studio; on the page it is the strip of tape you click, the pointer ticks on the rulers, and the text selection. Type is a condensed engineering sans, the kind printed on cutting mats and rulers, for headlines and numerals, over a plain humanist sans for reading. Japanese is a first-class language on the same URL, with a heavy rounded gothic for display and the system Japanese gothic for text.

Scope: this system is the landing page at `/` (`src/components/landing/`). The Studio and Viewer are an older, minimal utilitarian UI this world has not reached (see Do's and Don'ts); label yellow is the only colour the two already share.

**Key Characteristics:**

- Two surfaces with two printing inks: green mat with cream lines in the hero, off-white paper with ink everywhere below it.
- One set of role variables (foreground, soft foreground, print at full, major and minor strength, ruler background, focus, shadow tint) that each surface sets for itself, so a component prints correctly on whichever surface it lies on.
- The hero photo is the only object lying loose on the mat: tilted, taped, shadowed, settling once on load.
- On the paper, screenshots are printed flat on white plates inside crop marks: no tilt, no shadow, no tape.
- Label yellow kept for what you act on: the tape, the ruler cursor, selection, and focus on the mat.
- Square corners everywhere; edges are cut paper, torn tape and printed lines.
- English and Japanese with equal typographic care.

## Colors

A mid-green mat with cream printed lines in the hero, a warm off-white paper sheet printed in ink below it, and one hot yellow kept for what you act on.

### Primary

- **Mat Green** (`mat-green`): the hero only. Carries the cm grid and a faint fractal-noise grain (16% alpha, 180px tile) so it reads as matte rubber rather than a flat fill. Also the knock-out behind the dimension label.
- **Mat Deep** (`mat-deep`): the hero's ruler bands, and the text of the active language option. A half-step darker so the rulers read as a separate printed band.

### Secondary

- **Label Yellow** (`label-yellow`): the AR label colour from the product. On the page it is the call-to-action tape (on both surfaces), the pointer ticks and readouts on the rulers, the text selection, and the focus outline on the mat. Always ink on yellow.

### Neutral

On the mat:

- **Line Cream** (`line-cream`): everything printed on the mat at full strength: ruler ticks and numerals, the wordmark, dimension lines and labels, the outline button's stroke, the active language option's fill.
- **Line Major** (`line-major`): the 5 cm grid, ruler borders, half-centimetre ruler ticks, resting link underlines, the language switch border.
- **Line Minor** (`line-minor`): the 1 cm grid only.
- **Text White** (`text-white`): headlines and primary copy on the mat.
- **Text Soft** (`text-soft`): the lede, fine print and caption on the mat.
- **Paper** (`paper`): the border of the hero's AR print, the one loose sheet on the mat.
- **Masking Cream** (`masking-cream`): the translucent masking strips, on the hero print's corners and across the paper sheet's top edge.

On the paper:

- **Sheet** (`sheet`): the paper itself, from the mat's bottom edge to the end of the page, and the `html` background and scrollbar track.
- **Plate** (`plate`): the white plates the screenshots, the demo mat and the QR card are printed on. The full-screen demo mat is pure white too, because there it stands in for printer paper.
- **Ink** (`ink`): headlines, step numerals, the ink ruler's ticks and numbers, crop marks, focus outlines on the paper, text on the yellow tape, the QR modules.
- **Ink Soft** (`ink-soft`): ledes, body paragraphs, captions, notes and feature descriptions on the paper.
- **Ink Major** (`ink-major`): section and footer hairline rules, feature-list rules, resting link underlines, half-centimetre ticks on the ink ruler, the 45° and 60° guide.
- **Ink Minor** (`ink-minor`): the hairline border of every plate and the millimetre ticks on the ink ruler.

### Named Rules

**The Label Yellow Rule.** Yellow is the AR label colour and nothing else may borrow it. It marks only what responds to you: the action tape, the ruler cursor, selection, and focus on the mat. Never use it for decoration, headings, plates or a second accent.

**The Two Inks Rule.** Every line is printed at one of three strengths of its surface's ink: cream at full, 42% and 15% on the mat; ink at full, 30% and 10% on the paper. No grey, no green on the paper, no new opacities. Components take these through the surface's role variables instead of naming a colour.

**The Green Stays in the Hero Rule.** Mat green ends at the paper's top edge. Below it, the page is the paper sheet; nothing green is printed on it.

## Typography

**Display Font:** Barlow Condensed 600/700/800 (with sans-serif)
**Body Font:** Barlow 400/500/600 (with system-ui, sans-serif)
**Japanese Display:** M PLUS 1 800, with `palt` proportional kerning (with Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP)
**Japanese Body:** the system Japanese gothic stack (Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, Noto Sans CJK JP, Yu Gothic, Meiryo)
**Mono:** `ui-monospace, SFMono-Regular, Menlo, monospace`, only for inline code in notes (`code`), on a 7% ink chip with 1px 5px padding, wrapping anywhere.

**Character:** The condensed engineering sans printed on cutting mats and rulers, set heavy and tight, over a plain, open humanist sans for reading. Numerals are lining throughout and tabular on rulers and step numbers.

### Hierarchy

- **Display** (`display`): the one hero headline, white on the mat, balanced wrapping.
- **Headline** (`headline`): section headings, in ink on the paper.
- **Statement** (`statement`): the single large audience sentence (the section's h2), max 15em.
- **Numeral** (`numeral`): oversized step numbers beside step titles; the demo's numbered list uses the same voice at 1.75rem.
- **Title** (`title`, `title-sm`): step titles; feature-list terms and the QR card caption use the smaller size.
- **Body** (`body`): running copy; paragraphs wrap `pretty` and stop at 32 to 34em.
- **Lede** (`lede`): the sentence under the hero headline, max 33em; section ledes and the closing paragraph sit at 1.125rem.
- **Small** (`small`): captions, legends, notes, the fine print and the footer.
- **Code** (`code`): inline code inside notes only.
- **Tape label** (`label-tape`): the text on the yellow tape.
- **Dimension label** (`label-dimension`): text set into a dimension line, spaced 0.04em; the footer imprint uses the same voice.
- **Ruler numerals** (Barlow Condensed 600, 9px, left numbers 8.5px, below 640px; 10px from 640px; tabular): the centimetre counts in the rulers, plus 10px bold readouts on the yellow cursor. A scale marking, not a text size: decorative, `aria-hidden`, never used for content.

### Named Rules

**The Same Care in Both Languages Rule.** Every piece of copy exists in English and Japanese. Japanese headings get their own smaller sizes and looser leading (about 1.16 to 1.45), M PLUS 1 at 800 with `palt`, `word-break: keep-all`, and phrase breaks marked with `<wbr>` so lines never break inside a word. Japanese body runs at line-height 1.85 with strict line breaking.

**The Condensed Means Measured Rule.** Barlow Condensed is for headlines, numerals and things that measure (rulers, dimension labels, step numbers, the tape). Reading text is never condensed.

## Layout

The page measures itself in CSS centimetres (`spacing.cm`). Rulers are 0.75 cm wide below 640px and 1 cm from 640px. The hero's grid starts at the inner edge of the rulers. Content sits inside the left ruler with side padding of 0.6 cm, 1 cm from 640px and 2 cm from 1024px, in a column up to 1320px.

Vertical rhythm is in centimetres: sections are 2.5 cm top and bottom (the first section on the paper opens at 3 cm), the audience statement 3 cm, the closing section 2.5 cm over 3 cm, hero gaps 0.8 to 1.6 cm, steps 2.6 cm apart. Smaller in-component gaps are in px (8 to 40px). The four example plates under the statement sit 1.8 cm below it and 1.6 cm apart, with a 48px column gap so their crop marks never touch. Step 1's drop-area plate sits 40px under its paragraph; crop marks stand 18px outside each plate, so on phones, where it stacks above the Setup plate, it gets 20px more below it and the two sets of marks never touch.

From 1024px, sections use a 12-column grid with a 24px gutter. The hero takes 7 columns of copy against a 5-column photo print and fills the first viewport (up to 820px). The five steps alternate text (5 columns) and visual (6 columns) left and right. In step 1 the Studio's drop area (up to 472px, close to its real size) sits in the text column under the paragraph, and the visual is the Setup tab right after the drop. The demo puts 4 columns of copy against an 8-column mat; the feature list sits in 8 columns beside a 4-column heading and splits into two columns from 900px. Below 1024px everything stacks in one column. Nav links appear from 900px, the outline Studio button and the QR card from 640px; on phones the QR card is replaced by a hint, set off by a 1px ink rule, to open the page on a computer. The 45° and 60° guide appears behind the statement from 1024px. Under the statement, the four example cards go two across from 768px and stack below that.

**The One Scale Rule.** Things on the page are measured in the page's own centimetres. The rulers, the pointer readout and the hero's dimension line all read the same CSS cm (measured from a 1 cm probe), so a stated size always agrees with the rulers.

**The Unbroken Count Rule.** The left ruler runs the full height of the page with one count. On the mat it is the cream ruler on a mat-deep band; on the paper the same ruler is printed in ink on a transparent band, layered under the mat so the mat's own ruler covers its top.

## Elevation & Depth

Three physical layers, seen from above: the green mat; the paper sheet lying on it; and the one loose object on the mat, the hero's AR print. Depth is only where a real object would cast it. The paper's edge casts a thin contact shadow onto the mat (a 10px gradient from 34% green-black at the mat's bottom edge) and is held by two masking strips that overhang the seam. The hero print casts the rest shadow and settles into it on load. The yellow tape casts its own shadow through `drop-shadow`, so the shadow follows its torn ends, tinted by the surface it lies on: green-black on the mat, ink on the paper (the `--shade` role).

Everything printed is flat: text, rules, rulers, crop marks, and the plates on the paper. A plate is printed onto the sheet, not laid on it.

### Shadow Vocabulary

- **Rest** (`0 1px 1px rgb(0 0 0 / 0.2), 0 14px 30px -12px rgb(0 18 8 / 0.62)`): the hero print lying on the mat.
- **Lifted** (`0 2px 2px rgb(0 0 0 / 0.12), 0 40px 60px -18px rgb(0 18 8 / 0.5)`): the hero print in the air, only as the start frame of the settle.
- **Edge contact** (`linear-gradient(to top, rgb(0 18 8 / 0.34), transparent)`, 10px tall): where the paper sheet meets the mat.
- **Tape** (`drop-shadow(0 1px 1px rgb(0 0 0 / 0.22)) drop-shadow(0 8px 10px rgb(var(--shade) / 0.35))`, hover `drop-shadow(0 2px 2px rgb(0 0 0 / 0.18)) drop-shadow(0 14px 16px rgb(var(--shade) / 0.42))`): the action tape, `--shade` being `0 18 8` on the mat and `20 20 20` on the paper.

### Motion

Easing is one expo-out curve, `cubic-bezier(0.16, 1, 0.3, 1)`. The hero print settles onto the mat once, on load, over 1s after 0.1s: from 1.5° more tilt, 18px higher, 3% larger and lifted, down to rest. Nothing else animates in. The tape straightens and rises 2px on hover (0.4s), its arrow nudges 4px; it presses down 1px when active. Ruler cursor ticks fade in over 0.25s. The settle and the tape transitions are off under `prefers-reduced-motion: reduce`.

### Named Rules

**The Printed Is Flat Rule.** Only the paper's edge, the hero print and the tape cast shadows, and only the shadows above. Nothing printed (text, rules, rulers, plates, the nav) is ever lifted.

**The Already There Rule.** Motion starts from a visible state and runs once. Nothing waits invisible for a scroll trigger.

## Shapes

Every corner is square (`rounded.none`): paper is cut, tape is torn, rulers are printed. The masking strips and the action tape have zigzag torn ends, made with a conic-gradient mask (9px teeth on the tape, 7px on the strips). The hero print is turned about -2.5° and taped across both top corners at ±40°; the edge strips cross the paper's top edge at -3° and +2.5°; the tape is turned -1.2°. Plates on the paper are square to the page, with a 1px ink-minor hairline and printer's crop marks: 11px ink ticks set 18px outside each corner, with a 7px gap to the plate. Rules are 1px hairlines; outlined controls use a 1.5px stroke. Dimension lines have 11px end ticks with the measurement set into a gap in the line.

## Components

### Buttons

- **Action tape:** the primary action is a strip of label-yellow tape, not a button. Ink condensed label, a 12px gap to a right arrow, torn ends, turned -1.2°, tape shadow tinted for its surface. Hover straightens it to 0°, lifts it 2px and deepens the shadow; the arrow slides 4px. Active presses it 1px down. It appears twice: in the hero on the mat and in the closing section on the paper.
- **Outline button (Open Studio):** on the mat only. A 1.5px line-cream border, square, 600 weight, white text; hover fills with 10% white. Secondary navigation only.
- **Text button (Fill the screen):** looks like a text link, with an expand icon; underline at major strength, full on hover.
- **Focus:** a 2px outline at 4px offset in the surface's focus colour: yellow on the mat, ink on the paper.

### Links

- **Text link:** 600 weight, underlined at the surface's major strength at 0.28em offset, full-strength underline on hover, often with an arrow icon (down for in-page, up-right for external). Inline links in copy use the same underline at regular weight. Nav links carry no underline at rest and a full-strength underline on hover.

### Navigation

Printed on the mat beneath the top ruler: the wordmark in Barlow Condensed 800 at 1.75rem in line cream, then text links (from 900px), the language switch, and the outline Studio button (from 640px). No bar, no background, no sticky header. The footer is printed on the paper: the imprint in the dimension-label voice and a row of links, under a major-strength ink rule that spans the content column.

### Language Switch

On the mat only. Two square segments inside a 1.5px major-strength border: EN and 日本語, each labelled in its own language. Inactive is soft text, hover full; the active one is filled line cream with mat-deep text. It is driven by `data-lang` on the root so it is correct before hydration, and the choice is remembered.

### Hero Print

The one loose sheet on the mat: the AR photo in a 10px paper border, the rest shadow, turned about -2.5°, two masking strips across its top corners, settling once on load. Under it, a dimension caption.

### Plate (signature on the paper)

How a screen is printed on the paper: a white plate with a 1px ink-minor hairline, the image edge to edge inside it, and printer's crop marks at all four corners. Flat: no tilt, no shadow, no tape. Phone screenshots, the placement mat and the AR photo use narrower plates (270px, 400px and 440px max); the demo mat plate fills its column and can go full screen, where its border and crop marks drop away. The QR card is a plate too: white, ink-minor hairline, the QR code beside a title-sm caption.

### Paper Edge

Where the hero ends: the mat's bottom edge carries the edge-contact shadow, and two masking strips (`edge-strip`) sit across the seam, one just inside the left ruler and one 7% from the right edge, overhanging by 14px onto the paper.

### Rulers and Ruler Cursor (signature)

Ticks at 1 cm (52% of the band, full strength), 5 mm (34%) and 1 mm (20%), centimetre numbers, and a "cm" corner. In the hero the rulers are mat-deep bands with cream ticks along the top and left edges (the 5 mm ticks at full cream, the 1 mm ticks at major strength). The left ruler continues down the paper in ink (5 mm ticks at major, 1 mm at minor) with the same count. With a mouse or pen, yellow 2px ticks on the top and left rulers follow the pointer like a set square, with a yellow readout in cm to one decimal. Rulers are decorative and hidden from assistive tech.

### Dimension Caption

A figure caption under the hero print: a cream dimension line with end ticks, the print's measured width (in page cm) set into the line in the dimension-label voice on a mat-green knock-out, and the caption below in small soft text.

### Example Cards

One card per audience under the statement: a plate with a model labelled in the real Studio (its Preview, the same 3D view as step 5), then the audience in the smaller title size and one example sentence in ink soft. The Studio draws its labels at a fixed screen size, so the plates stay close to that size (up to 440px) to keep the labels readable; never shrink them to four across. Each picture has an English and a Japanese version, switched with the copy. A small legend under the cards says the models were made for the page.

### Feature List

Term and description pairs, each opened by a 1px major-strength ink rule; terms in the smaller title size, descriptions in ink soft. Two columns from 900px.

### Icons

Line icons drawn on a 24-unit grid with a 2px square-capped stroke in currentColor, sized 1em: arrows right, down, up-right and an expand mark. Icons accompany a text label; they are never the only content.

## Do's and Don'ts

### Do:

- **Do** keep mat green to the hero: grid, cream rulers, the taped AR print and the yellow tape; start the paper sheet at its bottom edge with the contact shadow and two masking strips.
- **Do** print everything below the hero on the paper in ink, and print screens on white plates with a hairline and crop marks.
- **Do** colour components through the surface roles (foreground, soft, print at full, major and minor, ruler background, focus, shade) so they print correctly on mat or paper.
- **Do** use label yellow only for the action tape, the ruler cursor, selection and focus on the mat.
- **Do** measure in the page's own centimetres, and keep the left ruler's count unbroken from mat to paper.
- **Do** write every string in English and Japanese, and give Japanese its own sizes, leading and phrase breaks.
- **Do** keep motion to the hero print's one settle, from an already-visible state, with reduced motion honoured.

### Don't:

- **Don't** put a phone mockup in the hero or line features up as a row of icon cards; the real AR photo, screenshots and the demo mat do the showing.
- **Don't** print green on the paper, or extend the mat below the hero.
- **Don't** tilt, shadow or tape a plate; on the paper, screens are printed flat.
- **Don't** round corners; paper, tape and rulers are square or torn.
- **Don't** use yellow as a second accent, a heading colour, a plate or decoration.
- **Don't** lift anything printed with a shadow, or use a shadow other than the rest, lifted, edge-contact and tape shadows.
- **Don't** set reading text in Barlow Condensed, or use the ruler's 8.5 to 10px numeral size for anything a person needs to read.
- **Don't** use the mono stack for anything but inline code in notes.
- **Don't** treat the Studio and Viewer's older UI (system fonts, white or near-black surfaces, the blue `#1f6feb` / `#4c8dff` link accent in `src/app/globals.css` and `src/app/studio/studio.module.css`) as part of this system, and don't extend the cutting-mat world to them without a deliberate redesign; label yellow is the only colour they share today.
