# MGPS ERP Mobile releases

## Install once

Build and install the production APK once. This APK is configured to receive
Expo OTA updates from the `production` channel:

```powershell
npm run build:android:production
```

Install the APK from the build link over the existing app. Do not uninstall
first; Android can keep the app's local data when the package name and signing
key match. If Android rejects the update because the signing key is different,
the APK must be signed with the same key as the installed version before it can
be installed in place.

## Publish JavaScript and UI updates

For changes that do not add or change native Android/iOS code or native
dependencies, publish an OTA update:

```powershell
npm run update:production -- --message "Describe the update"
```

The app checks for production updates on launch, downloads the update in the
background, and uses it on the next app restart. Users do not need to uninstall
or manually install an APK. The phone must have internet access to receive the
update.

To test an update before releasing it to everyone, build a preview APK and
publish to the preview channel:

```powershell
npm run build:android:preview
npm run update:preview -- --message "Describe the preview"
```

## Changes that need a new APK

Native code, native dependencies, app permissions, or native app configuration
cannot be delivered by an OTA update. Build a new APK instead:

```powershell
npm run build:android:production
```

Install that APK over the existing app; an uninstall should not be needed when
the package name and signing key are unchanged. Keep the `production` channel
and the app's `runtimeVersion` policy aligned with each build.
