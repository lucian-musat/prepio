import type { Metadata } from 'next';
import { Nunito, Nunito_Sans } from 'next/font/google';
import 'bootstrap/dist/css/bootstrap.min.css';
import './theme.css';
import { themeVariablesCss } from './theme';

const nunito = Nunito({ subsets: ['latin', 'latin-ext'], weight: ['800', '900'], variable: '--font-head', display: 'swap' });
const nunitoSans = Nunito_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'Prepio – Administrare',
  description: 'Panou de administrare Prepio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" data-scroll-behavior="smooth" className={`${nunito.variable} ${nunitoSans.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeVariablesCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
