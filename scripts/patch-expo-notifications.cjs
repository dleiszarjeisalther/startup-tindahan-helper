const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'build',
  'TopicSubscriptionModule.android.js'
);

if (fs.existsSync(targetFile)) {
  const content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes("requireNativeModule('ExpoTopicSubscriptionModule')")) {
    const patched = `import { requireOptionalNativeModule } from 'expo';

const fallback = {
    addListener: () => {},
    removeListeners: () => {},
    subscribeToTopicAsync: () => Promise.resolve(null),
    unsubscribeFromTopicAsync: () => Promise.resolve(null),
};

export default requireOptionalNativeModule('ExpoTopicSubscriptionModule') ?? fallback;

//# sourceMappingURL=TopicSubscriptionModule.android.js.map
`;
    fs.writeFileSync(targetFile, patched, 'utf8');
    console.log('[patch] Successfully patched TopicSubscriptionModule.android.js for Expo Go');
  }
}
