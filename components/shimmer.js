export function Shimmer({ width = "100%", height = 16 }) {
  return (
    <span className="shimmer" style={{ width, height }} aria-hidden="true" />
  );
}
export function LayoutShimmer({ page = "Students", detail = false }) {
  const list = ["Students", "Unassigned pool"].includes(page);
  return (
    <div role="status" aria-label="Loading" aria-busy="true">
      <Shimmer width="45%" height={28} />
      {page === "Overview" && (
        <div className="stats">
          {Array.from({ length: 4 }, (_, i) => (
            <section key={i}>
              <Shimmer />
              <Shimmer height={40} />
            </section>
          ))}
        </div>
      )}
      <section className="panel padded">
        <Shimmer width="35%" height={22} />
        {list && !detail && (
          <div className="filters">
            <Shimmer height={40} />
            <Shimmer height={40} />
          </div>
        )}
        {Array.from({ length: detail ? 4 : 6 }, (_, i) => (
          <div
            className={list && !detail ? "shimmer-row" : "shimmer-card"}
            key={i}
          >
            {Array.from({ length: list && !detail ? 4 : 1 }, (_, j) => (
              <Shimmer key={j} height={detail ? 36 : 24} />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
export default function WorkspaceShimmer({ page }) {
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          E <span>Extopr / CallDesk</span>
        </div>
        {Array.from({ length: 7 }, (_, i) => (
          <Shimmer key={i} height={38} />
        ))}
      </aside>
      <div className="main">
        <header>
          <Shimmer width={180} />
        </header>
        <main className="content">
          <LayoutShimmer page={page} />
        </main>
      </div>
    </div>
  );
}
