/**
 * Tab layout using Expo Router's native iOS tabs.
 *
 * NativeTabs provides a true UITabBar on iOS with SF Symbols.
 * Uses the SDK 54 API from 'expo-router/unstable-native-tabs'.
 *
 * Reference: https://docs.expo.dev/router/advanced/native-tabs/
 */
import { DynamicColorIOS, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

export default function TabLayout() {
  const glassAvailable = isLiquidGlassAvailable();

  return (
    <NativeTabs
      labelStyle={Platform.OS === 'ios' ? {
        color: DynamicColorIOS({ dark: 'white', light: 'black' }),
      } : undefined}
      tintColor={Platform.OS === 'ios'
        ? DynamicColorIOS({ dark: 'white', light: 'black' })
        : undefined
      }
    >
      <NativeTabs.Trigger name="books">
        <Label>Books</Label>
        <Icon
          sf={{ default: 'book', selected: 'book.fill' }}
          androidSrc={<VectorIcon family={MaterialIcons} name="auto-stories" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role={glassAvailable ? 'search' : undefined}>
        <Label>Search</Label>
        <Icon
          sf="magnifyingglass"
          androidSrc={<VectorIcon family={MaterialIcons} name="search" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          androidSrc={<VectorIcon family={MaterialIcons} name="settings" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
