'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, Container, Nav, Navbar } from 'react-bootstrap';
import { logout } from '../login/actions';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/', label: 'Conținut' },
    { href: '/templates', label: 'Șabloane de rezolvare' },
    { href: '/students', label: 'Elevi' },
    { href: '/settings', label: 'Setări' },
  ];
  return (
    <div className="min-vh-100 d-flex flex-column">
      <Navbar className="navbar-prepio px-3">
        <Link href="/" className="brand navbar-brand mb-0">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>Prepio</span>
          <span className="brand-sub">admin</span>
        </Link>
      </Navbar>
      <Container fluid className="flex-grow-1">
        <div className="row h-100">
          <aside className="col-12 col-md-3 col-lg-2 py-3 border-end sidebar">
            <Nav className="flex-md-column gap-1" as="nav" aria-label="Navigare">
              {links.map((l) => (
                <Nav.Link
                  key={l.href}
                  as={Link}
                  href={l.href}
                  active={l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)}
                >
                  {l.label}
                </Nav.Link>
              ))}
              <form action={logout}>
                <Button type="submit" variant="link" className="nav-link btn-link">
                  Ieșire
                </Button>
              </form>
            </Nav>
          </aside>
          <main className="col-12 col-md-9 col-lg-10 py-4 px-md-4">{children}</main>
        </div>
      </Container>
    </div>
  );
}
