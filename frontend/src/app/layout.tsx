import React from 'react';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata = {
  title: 'SLABound | Autonomous API SLA Arbitration Engine',
  description: 'Autonomous agentic platform monitoring 3rd-party APIs, verifying SLA breaches via zk-SNARK telemetry proofs, and executing programmatic refunds.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#090D16] text-gray-100 flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
