export function Stats({ total, played, remaining, percent }) {
  return (
    <section className="stats" aria-label="Progress">
      <div className="stats__grid">
        <div className="stats__item">
          <span className="stats__value">{total}</span>
          <span className="stats__label">Total</span>
        </div>
        <div className="stats__item stats__item--accent">
          <span className="stats__value">{played}</span>
          <span className="stats__label">Played</span>
        </div>
        <div className="stats__item">
          <span className="stats__value">{remaining}</span>
          <span className="stats__label">Left</span>
        </div>
        <div className="stats__item">
          <span className="stats__value">{percent}%</span>
          <span className="stats__label">Complete</span>
        </div>
      </div>
    </section>
  );
}
