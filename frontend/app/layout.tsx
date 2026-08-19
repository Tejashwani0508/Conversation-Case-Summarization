import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conversation Intelligence',
  description: 'AI-powered customer service intelligence and case summarization.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}