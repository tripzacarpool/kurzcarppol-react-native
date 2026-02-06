/**
 * Script to clear driver offers from AsyncStorage
 *
 * To use this in your app, add this code to a button or run it in console:
 *
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 *
 * const clearOffers = async () => {
 *   const keys = await AsyncStorage.getAllKeys();
 *   const offerKeys = keys.filter(key => key.startsWith('driver_offers_'));
 *   await AsyncStorage.multiRemove(offerKeys);
 *   console.log('✅ Cleared', offerKeys.length, 'offer keys');
 * };
 *
 * clearOffers();
 */

export const clearDriverOffersFromStorage = async () => {
  try {
    const AsyncStorage = (
      await import('@react-native-async-storage/async-storage')
    ).default;
    const keys = await AsyncStorage.getAllKeys();
    const offerKeys = keys.filter((key) => key.startsWith('driver_offers_'));

    if (offerKeys.length > 0) {
      await AsyncStorage.multiRemove(offerKeys);
      console.log(
        '✅ Cleared',
        offerKeys.length,
        'driver offer keys from storage',
      );
      return offerKeys.length;
    } else {
      console.log('ℹ️ No driver offer keys found');
      return 0;
    }
  } catch (error) {
    console.error('❌ Error clearing driver offers:', error);
    throw error;
  }
};
