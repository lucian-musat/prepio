import type { Metadata } from 'next';
import { Lora, Source_Sans_3 } from 'next/font/google';
import 'bootstrap/dist/css/bootstrap.min.css';
import './theme.css';
import { themeVariablesCss } from './theme';

const lora = Lora({ subsets: ['latin', 'latin-ext'], variable: '--font-lora', display: 'swap' });
const sourceSans = Source_Sans_3({ subsets: ['latin', 'latin-ext'], variable: '--font-source-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Prepio – Administrare',
  description: 'Panou de administrare Prepio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" data-scroll-behavior="smooth" className={`${lora.variable} ${sourceSans.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeVariablesCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
