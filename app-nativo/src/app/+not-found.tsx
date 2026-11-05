import { router } from 'expo-router';
import { EmptyState } from '../ui/EmptyState';
export default function NotFound() { return <EmptyState title="Vamos voltar para casa?" message="Este caminho não está disponível." action="Voltar ao início" onAction={() => router.replace('/')} />; }
