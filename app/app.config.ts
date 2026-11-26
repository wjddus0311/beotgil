export default {
  expo: {
    name: '벗길', slug: 'beotgil', version: '1.0.0', orientation: 'default',
    userInterfaceStyle: 'light',
    ios: { bundleIdentifier: 'kr.beotgil.app', supportsTablet: true,
      infoPlist: { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } },
    android: { package: 'kr.beotgil.app' },
    plugins: ['expo-status-bar',
      ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || '' }],
      ['expo-location', { locationWhenInUsePermission: '현재 위치를 출발지로 지정하고 가까운 대피장소를 찾는 데 사용합니다.' }]],
  },
};
