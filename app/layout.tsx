import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ProofPay — Evidence Finance',
  description: 'Evidence-based escrow and dispute resolution. Agreements bound to deliverables, adjudicated by a GenLayer Intelligent Contract.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
