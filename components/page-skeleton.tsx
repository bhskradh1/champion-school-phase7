/*
 * SMOOTHNESS: shown instantly while a page's data is loading.
 *
 * Without a loading.tsx file, clicking a link seems to "do nothing" until the
 * server has finished ALL the database work. With this file, the page frame
 * appears immediately and the real content replaces it when ready.
 *
 * The empty dark <aside> keeps the sidebar area filled, so the layout does
 * not jump when the real sidebar arrives.
 */
export default function PageSkeleton() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-hidden="true" />

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
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="skeleton-row">
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
