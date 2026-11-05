import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import BottomNav from '@/app/ui/BottomNav';
import { ToastProvider } from '@/app/ui/toast';
import { UserProvider } from '@/app/ui/user';

// Tudo dentro de (app) exige login. Quem não tem sessão vai para /entrar.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/entrar');
  return (
    <UserProvider user={user}>
      <ToastProvider>
        <main className="pb-nav mx-auto min-h-dvh max-w-lg">{children}</main>
        <BottomNav />
      </ToastProvider>
    </UserProvider>
  );
}
