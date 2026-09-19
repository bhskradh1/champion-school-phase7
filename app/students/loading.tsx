export default function StudentsLoading() {
  return (
    <div className="app-shell">
      <main className="main">
        <div className="content">
          <div className="page-head">
            <div>
              <div className="skeleton-line small" />
              <div className="skeleton-line title" />
              <div className="skeleton-line text" />
            </div>
          </div>

          <section className="panel">
            <div className="skeleton-table">
              {Array.from({
                length: 8,
              }).map((_, index) => (
                <div
                  key={index}
                  className="skeleton-row"
                >
                  <div className="skeleton-block avatar-block" />
                  <div className="skeleton-block wide-block" />
                  <div className="skeleton-block medium-block" />
                  <div className="skeleton-block medium-block" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
