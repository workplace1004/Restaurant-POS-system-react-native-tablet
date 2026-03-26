import { installLocalStorageShim } from './src/lib/setupRuntime';

installLocalStorageShim(['pos-user', 'pos-view', 'pos_device_settings']);

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
