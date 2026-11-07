'use client';

import { useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import type { SettingsInput } from '@/lib/data/settings';
import { saveSettings } from './actions';

export default function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [welcomeMessage, setWelcomeMessage] = useState(initial.welcomeMessage);
  const [rules, setRules] = useState(initial.rules);
  const [model, setModel] = useState(initial.model);
  const [saved, setSaved] = useState(false);
  const { run, pending, alert } = useRunner();
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setSaved(false); };

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(
          () => saveSettings({ welcomeMessage, rules, model }),
          () => setSaved(true),
        );
      }}
    >
      {alert}
      <Card className="mb-4">
        <Card.Body>
          <Form.Group controlId="welcome-message">
            <Form.Label>Mesaj de bun venit</Form.Label>
            <Form.Control as="textarea" rows={3} value={welcomeMessage} onChange={(e) => touch(setWelcomeMessage)(e.target.value)} />
            <Form.Text muted>Afișat elevilor pe ecranul de start al aplicației.</Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title as="h2" className="h5 mb-3">Evaluare AI</Card.Title>
          <Form.Group controlId="ai-rules" className="mb-3">
            <Form.Label>Reguli generale</Form.Label>
            <Form.Control as="textarea" rows={14} value={rules} onChange={(e) => touch(setRules)(e.target.value)} />
            <Form.Text muted>Reguli valabile pentru orice exercițiu evaluat cu AI (rol, limbă, ton). Instrucțiunile pe tip de exercițiu stau în Șabloane AI.</Form.Text>
          </Form.Group>
          <Form.Group controlId="ai-model">
            <Form.Label>Model</Form.Label>
            <Form.Control value={model} onChange={(e) => touch(setModel)(e.target.value)} />
            <Form.Text muted>Numele modelului OpenAI folosit la evaluare, de exemplu gpt-5-mini.</Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      <div className="d-flex align-items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>Salvează setările</Button>
        {saved && <span className="text-success" role="status">Setările au fost salvate.</span>}
      </div>
    </Form>
  );
}
