import { Card, CardBody } from 'react-bootstrap';
import LoginForm from './LoginForm';
import { NOT_ADMIN_MESSAGE } from './messages';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  // The proxy bounces signed-in non-admins here with ?error=not_admin.
  const { error } = await searchParams;
  const initialError = error === 'not_admin' ? NOT_ADMIN_MESSAGE : null;
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-3">
      <Card style={{ width: '100%', maxWidth: 400 }} className="border-0 border-top border-3 border-warning">
        <CardBody className="p-4">
          <h1 className="h3 text-center mb-1">Prepio</h1>
          <p className="text-center text-secondary mb-4">Administrare conținut</p>
          <LoginForm initialError={initialError} />
        </CardBody>
      </Card>
    </main>
  );
}
