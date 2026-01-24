import { View, StyleSheet } from 'react-native';

interface AnimatedScreenProps {
  children: React.ReactNode;
}

export function AnimatedScreen({ children }: AnimatedScreenProps) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
