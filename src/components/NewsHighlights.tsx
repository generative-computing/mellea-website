import type { NewsItem } from '@/lib/news';

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function NewsHighlights({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="news-strip">
      {items.map((item) => (
        <a
          key={item.slug}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="news-card"
          data-category={item.category.toLowerCase()}
        >
          <div className="news-card-top">
            <span className="news-card-category">{item.category}</span>
            <span className="news-card-date">{formatDate(item.date)}</span>
          </div>
          <h3 className="news-card-title">{item.title}</h3>
          <p className="news-card-excerpt">{item.excerpt}</p>
          <span className="news-card-link">
            {item.source ? `${item.source} ↗` : 'Read more ↗'}
          </span>
        </a>
      ))}
    </div>
  );
}
