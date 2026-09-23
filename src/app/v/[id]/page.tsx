export default async function ViewerPage(props: PageProps<'/v/[id]'>) {
  const { id } = await props.params;
  return (
    <main className="stub">
      <h1>Exhibit {id}</h1>
      <p>Landing card + Start AR (WS-D).</p>
    </main>
  );
}
