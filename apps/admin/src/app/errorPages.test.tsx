// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureBoundaryError } from '@/lib/sentry';
import AdminError from './(admin)/error';
import AdminLoading from './(admin)/loading';
import GlobalError from './global-error';
import NotFound from './not-found';

vi.mock('@/lib/sentry', () => ({ captureBoundaryError: vi.fn() }));
const capture = vi.mocked(captureBoundaryError);

afterEach(() => {
  cleanup();
  capture.mockClear();
});

// A digest means the error happened on the server, where `onRequestError` already reported it.
describe.each([
  ['(admin)/error', (error: Error) => render(<AdminError error={error} reset={() => {}} />)],
  ['global-error', (error: Error) => render(<GlobalError error={error} reset={() => {}} />, { container: document })],
])('%s reporting', (_name, renderWith) => {
  it('reports a client error (no digest) as unhandled', () => {
    const error = new Error('client crash');
    renderWith(error);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error);
  });

  it('does not report a server error again (it has a digest)', () => {
    renderWith(Object.assign(new Error('server'), { digest: 'abc123' }));
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('(admin)/error', () => {
  it('shows the generic message, the digest and a working retry, never the error message', async () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('secret internal detail'), { digest: 'abc123' });
    render(<AdminError error={error} reset={reset} />);
    expect(screen.getByText('Ceva n-a mers bine pe această pagină.')).toBeTruthy();
    expect(screen.getByText(/abc123/)).toBeTruthy();
    expect(screen.queryByText(/secret internal detail/)).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Încearcă din nou' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('omits the digest line when there is none', () => {
    render(<AdminError error={new Error('x')} reset={() => {}} />);
    expect(screen.queryByText(/Cod:/)).toBeNull();
  });
});

describe('not-found', () => {
  it('says the page is missing and links home', () => {
    render(<NotFound />);
    expect(screen.getByText('Pagina nu există')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/');
  });
});

describe('(admin)/loading', () => {
  it('shows a labelled spinner', () => {
    render(<AdminLoading />);
    expect(screen.getByLabelText('Se încarcă')).toBeTruthy();
  });
});

describe('global-error', () => {
  it('renders its own html shell with a reload button', () => {
    const reset = vi.fn();
    const { container } = render(<GlobalError error={new Error('x')} reset={reset} />, { container: document });
    expect(container.querySelector('html')?.getAttribute('lang')).toBe('ro');
    expect(screen.getByRole('button', { name: 'Reîncarcă' })).toBeTruthy();
  });
});
