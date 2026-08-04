import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocQuery',
  description: 'Ask questions about your documents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink antialiased min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
