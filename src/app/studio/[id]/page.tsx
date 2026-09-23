export default async function ProjectEditorPage(props: PageProps<'/studio/[id]'>) {
  const { id } = await props.params;
  return (
    <main className="stub">
      <h1>Exhibit {id}</h1>
      <p>Setup · Mat · Annotate · Preview · Publish (WS-F).</p>
    </main>
  );
}
