import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pastibot.app',
  appName: 'Pastibot',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
      webClientId: '967662848926-k5uikarqm0t1lkka5aqbug7q2oai20ug.apps.googleusercontent.com',
    },
  },
};

export default config;
