import type { Project } from '../types';
import { tileLabel, TILE_OVERLAP_MM } from './paper';

/** Plain-text printing and setup checklist shown on publish and included in downloads. */
export function printInstructions(
  layout: Pick<Project['mat'], 'paper' | 'orientation' | 'tiles'>,
  title: string,
): string {
  const { paper, orientation, tiles } = layout;
  const sheets = tiles.cols * tiles.rows;
  const lines = [
    `Placement mat for "${title}"`,
    '',
    'Printing',
    `1. Print on ${paper} (${orientation})${sheets > 1 ? `, ${sheets} sheets (${tiles.cols} × ${tiles.rows})` : ''}.`,
    '2. Choose "Actual size" / 100 %. Turn OFF "Fit to page" and any scaling.',
    '3. Measure the black-and-white bar on the mat: it must be exactly 100 mm.',
    '   If it is not, fix the printer settings and print again. Tracking depends on it.',
  ];
  if (sheets > 1) {
    const labels = Array.from({ length: tiles.rows }, (_, row) =>
      Array.from({ length: tiles.cols }, (_, col) => tileLabel(col, row)),
    )
      .flat()
      .join(', ');
    lines.push(
      '',
      'Assembling the sheets',
      `4. Sheets are labelled ${labels} (letter = column, number = row).`,
      `5. Neighbouring sheets overlap by ${TILE_OVERLAP_MM} mm. Line up the grey crosshairs,`,
      '   trim the overlap from one sheet, and tape from the back.',
    );
  }
  const n = sheets > 1 ? 6 : 4;
  lines.push(
    '',
    'Setting up',
    `${n}. Mount the mat on card or foam board so it stays flat. Avoid glossy lamination (glare).`,
    `${n + 1}. Place the printed object on the solid outline with its front toward FRONT.`,
    `${n + 2}. Keep the square markers uncovered and evenly lit.`,
    `${n + 3}. Open calibration on your phone once to fine-tune the alignment.`,
    '',
  );
  return lines.join('\n');
}
