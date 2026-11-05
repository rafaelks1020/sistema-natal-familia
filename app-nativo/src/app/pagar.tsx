import { Redirect } from 'expo-router';
import { useSession } from '../session';
import Pagar from '../screens/pagar/Pagar';

export default function PaymentRoute() {
  const { status } = useSession();
  if (status !== 'authenticated') return <Redirect href="/entrar" />;
  return <Pagar />;
}
