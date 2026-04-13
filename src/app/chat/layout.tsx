import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Julia — Conversa',
  description: 'Converse com Julia, sua companheira virtual carinhosa e acolhedora.',
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
