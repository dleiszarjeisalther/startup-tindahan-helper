const fs = require('node:fs');
const path = require('node:path');

// Android SurfaceView is composed separately from React Native screens. Use
// TextureView so tab transitions cannot leave a stale surface over other pages.
const file = path.join(path.dirname(require.resolve('expo-camera/package.json')),
  'android/src/main/java/expo/modules/camera/ExpoCameraView.kt');
const source = fs.readFileSync(file, 'utf8');
const setting = 'implementationMode = PreviewView.ImplementationMode.COMPATIBLE';
if (!source.includes(setting)) {
  const anchor = 'private var previewView = PreviewView(context).apply {';
  if (source.split(anchor).length !== 2) {
    throw new Error('Camera preview changed upstream; review the Android compatibility patch before building.');
  }
  fs.writeFileSync(file, source.replace(anchor, `${anchor}\n    ${setting}`));
}
console.log('[camera] Android preview uses TextureView compatibility mode.');
