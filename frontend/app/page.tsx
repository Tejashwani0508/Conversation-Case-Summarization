import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conversation & Case Summarization',
  description: 'AI-powered customer service case summarization application.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/80 p-10 shadow-xl shadow-slate-950/20">
        <h1 className="text-4xl font-semibold">Conversation & Case Summarization</h1>
        <p className="mt-4 max-w-2xl leading-8 text-slate-300">
          A clean foundational setup for a customer service AI application with a separated frontend and backend architecture.
        </p>
      </div>
    </main>
  );
}
