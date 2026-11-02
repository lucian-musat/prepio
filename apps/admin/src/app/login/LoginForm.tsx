'use client';

import { useActionState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { login, type LoginState } from './actions';

export default function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: initialError });
  return (
    <Form action={action}>
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      <Form.Group className="mb-3" controlId="email">
        <Form.Label>Email</Form.Label>
        <Form.Control type="email" name="email" autoComplete="username" required />
      </Form.Group>
      <Form.Group className="mb-4" controlId="password">
        <Form.Label>Parolă</Form.Label>
        <Form.Control type="password" name="password" autoComplete="current-password" required />
      </Form.Group>
      <Button type="submit" variant="primary" className="w-100" disabled={pending}>
        {pending ? 'Se verifică…' : 'Intră'}
      </Button>
    </Form>
  );
}
