import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { theme } from '../../theme';
export default function TabsLayout() {
  return <NativeTabs tintColor={theme.colors.cherry} backgroundColor={theme.colors.background}
    iconColor={{ default: theme.colors.secondary, selected: theme.colors.cherry }}
    labelStyle={{ default: { color: theme.colors.secondary, fontSize: 10 }, selected: { color: theme.colors.cherry, fontSize: 10 } }}
    indicatorColor={theme.colors.field} disableTransparentOnScrollEdge>
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" /></NativeTabs.Trigger>
    <NativeTabs.Trigger name="mural"><NativeTabs.Trigger.Label>Mural</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" md="forum" /></NativeTabs.Trigger>
    <NativeTabs.Trigger name="amigo-oculto"><NativeTabs.Trigger.Label>Amigo oculto</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="gift" md="redeem" /></NativeTabs.Trigger>
    <NativeTabs.Trigger name="vaquinha"><NativeTabs.Trigger.Label>Vaquinha</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="banknote" md="savings" /></NativeTabs.Trigger>
    <NativeTabs.Trigger name="album"><NativeTabs.Trigger.Label>Álbum</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="photo.on.rectangle" md="photo_library" /></NativeTabs.Trigger>
  </NativeTabs>;
}
