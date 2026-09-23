import Link from 'next/link';

export default function StudioPage() {
  return (
    <main className="stub">
      <h1>Studio</h1>
      <p>Your exhibits will be listed here.</p>
      <p>
        <Link href="/studio/new">New exhibit</Link>
      </p>
    </main>
  );
}
