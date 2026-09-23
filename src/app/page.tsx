import Link from 'next/link';

export default function Home() {
  return (
    <main className="stub">
      <h1>ExhibitAR</h1>
      <p>Turn any 3D-printed object into an AR exhibit.</p>
      <p>
        <Link href="/studio">Open the Studio</Link>
      </p>
    </main>
  );
}
