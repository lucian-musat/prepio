import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center py-5">
      <h1 className="h4 mb-3">Pagina nu există</h1>
      <Link href="/" className="btn btn-primary">
        Înapoi la start
      </Link>
    </div>
  );
}
