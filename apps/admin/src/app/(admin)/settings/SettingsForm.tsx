'use client';

import { useState } from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import type { SettingsInput } from '@/lib/data/settings';
import { saveSettings } from './actions';

export default function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [welcomeMessage, setWelcomeMessage] = useState(initial.welcomeMessage);
  const [rules, setRules] = useState(initial.rules);
  const [gradeMin, setGradeMin] = useState(String(initial.gradeMin));
  const [gradeMax, setGradeMax] = useState(String(initial.gradeMax));
  const [model, setModel] = useState(initial.model);
  const [saved, setSaved] = useState(false);
  const { run, pending, alert } = useRunner();
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setSaved(false); };

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        // Number('') is 0, so empty fields are sent as NaN and rejected by validation.
        const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
        run(
          () => saveSettings({ welcomeMessage, rules, gradeMin: num(gradeMin), gradeMax: num(gradeMax), model }),
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
            <Form.Label>Reguli de evaluare</Form.Label>
            <Form.Control as="textarea" rows={14} value={rules} onChange={(e) => touch(setRules)(e.target.value)} />
            <Form.Text muted>Instrucțiunile trimise modelului AI pentru evaluarea eseurilor.</Form.Text>
          </Form.Group>
          <Row className="mb-3">
            <Col xs={6} md={3}>
              <Form.Group controlId="grade-min">
                <Form.Label>Nota minimă</Form.Label>
                <Form.Control type="number" step={1} value={gradeMin} onChange={(e) => touch(setGradeMin)(e.target.value)} />
              </Form.Group>
            </Col>
            <Col xs={6} md={3}>
              <Form.Group controlId="grade-max">
                <Form.Label>Nota maximă</Form.Label>
                <Form.Control type="number" step={1} value={gradeMax} onChange={(e) => touch(setGradeMax)(e.target.value)} />
              </Form.Group>
            </Col>
          </Row>
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
