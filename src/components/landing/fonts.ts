import { Barlow, Barlow_Condensed, M_PLUS_1 } from 'next/font/google';

/** Ruler numerals and headlines: the condensed engineering sans printed on cutting mats. */
export const displayFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const textFont = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-text',
  display: 'swap',
});

/**
 * Japanese display type (headings, the tape, the statement) in one weight.
 * Japanese body text uses the system's Japanese fonts. Google serves this in
 * unicode-range slices, so only the glyphs a page uses load.
 */
export const jaFont = M_PLUS_1({
  subsets: ['latin'],
  weight: '800',
  variable: '--font-ja',
  display: 'swap',
  preload: false,
});
