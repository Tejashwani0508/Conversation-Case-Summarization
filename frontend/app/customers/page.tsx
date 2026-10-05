'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { AppHeader, EmptyState } from '../../components/dashboard';
import { listCustomers } from '../../services/api';
import type { Customer } from '../../types/customer-types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listCustomers({ page: 1, page_size: 100 });
      setCustomers(response.items);
    } catch {
      setError('Unable to load customers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader active="customers" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Customer Directory</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Customers</h1>
          </div>
          <Link href="/" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            ← Dashboard
          </Link>
        </header>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              onClick={() => void loadCustomers()}
              className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 h-4 w-24 rounded bg-slate-200" />
                <div className="mb-2 h-5 w-40 rounded bg-slate-200" />
                <div className="h-4 w-52 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            description="Customer records will appear here once they are created."
            actionLabel="View Cases"
            actionHref="/cases"
            icon={<span className="text-base font-semibold">👥</span>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {customers.map((customer) => (
              <article key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Customer</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{customer.name}</h2>
                <dl className="mt-4 space-y-2 text-sm text-slate-600">
                  {customer.email && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Email</dt>
                      <dd>{customer.email}</dd>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Phone</dt>
                      <dd>{customer.phone}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Account</dt>
                    <dd className="font-mono text-[11px] text-slate-700">{customer.account_number}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
