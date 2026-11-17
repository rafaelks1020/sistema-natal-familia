import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { theme } from '../../theme';
// As mesmas cinco abas do site: a pessoa aprende um caminho só.
export default function TabsLayout() {
  return <NativeTabs tintColor={theme.colors.cherry} backgroundColor={theme.colors.background}
    iconColor={{ default: theme.colors.secondary, selected: theme.colors.cherry }}
    labelStyle={{ default: { color: theme.colors.secondary, fontSize: 12 }, selected: { color: theme.colors.cherry, fontSize: 12 } }}
    indicatorColor={theme.colors.field} disableTransparentOnScrollEdge>
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Label>Hoje</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" /></NativeTabs.Trigger>
    <NativeTabs.Trigger name="aba-ceia"><NativeTabs.Trigger.Label>Ceia</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" /></NativeTabs.Trigger>
    <NativeTabs.Trigger name="aba-festa"><NativeTabs.Trigger.Label>Festa</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="party.popper" md="celebration" /></NativeTabs.Trigger>
    <NativeTabs.Trigger name="aba-familia"><NativeTabs.Trigger.Label>Família</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="person.2" md="group" /></NativeTabs.Trigger>
    <NativeTabs.Trigger name="aba-eu"><NativeTabs.Trigger.Label>Eu</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" /></NativeTabs.Trigger>
  </NativeTabs>;
}
