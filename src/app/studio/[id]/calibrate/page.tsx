export default async function CalibratePage(props: PageProps<'/studio/[id]/calibrate'>) {
  const { id } = await props.params;
  return (
    <main className="stub">
      <h1>Calibrate {id}</h1>
      <p>Phone AR calibration: ghost model + nudge controls (WS-D5).</p>
    </main>
  );
}
