import { supabase } from './supabase';

export async function fetchAndStoreUserIP(userId: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    const ipAddress = data.ip;

    if (ipAddress) {
      await supabase
        .from('profiles')
        .update({
          ip_address: ipAddress,
          last_ip_update: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    return ipAddress;
  } catch (error) {
    console.error('Failed to fetch IP address:', error);
    return null;
  }
}

export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }
}
