import Link from 'next/link';
import styles from './studio/studio.module.css';

export default function Home() {
  return (
    <main className={styles.narrow} style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 34, lineHeight: 1.1 }}>ExhibitAR</h1>
      <p style={{ fontSize: 18, lineHeight: 1.5 }}>
        Turn any 3D-printed object into an AR exhibit. Upload the STL, mark what matters, print a
        placement mat. Visitors scan a QR code and see labels on the real object.
      </p>
      <div className={styles.row}>
        <Link className={styles.primary} href="/studio">
          Open the Studio
        </Link>
        <Link className={styles.secondary} href="/v/mockcube01">
          Try the demo exhibit
        </Link>
      </div>
      <ol className={styles.muted} style={{ paddingLeft: 20, display: 'grid', gap: 6 }}>
        <li>Upload an STL — it is processed in your browser and never uploaded.</li>
        <li>Choose how it stands and which side faces the visitor.</li>
        <li>Print the generated mat at 100 % and place the printed object on its outline.</li>
        <li>Add points and painted regions with text; publish; calibrate once on a phone.</li>
      </ol>
    </main>
  );
}
