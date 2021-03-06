const EvdevReader = require('evdev');

const DEVICE_PATH = '/dev/input/event0';

function readDeviceCapabilities(devicePath, cb) {
  // FIXME: use ioctl to get this info to ensure it's correct
  // this data came from `$ evtest /dev/input/event0`
  setTimeout(cb, 0, null, {
    driverVersion: '1.0.1',
    id: {
      bus: 0x5, vendor: 0x45E, product: 0x2E0, version: 0x903,
    },
    name: 'Xbox Wireless Controller',
    supportedEvents: {
      EV_SYN: true,
      EV_KEY: [
        'KEY_HOMEPAGE',
        'BTN_SOUTH',
        'BTN_EAST',
        'BTN_NORTH',
        'BTN_WEST',
        'BTN_TL',
        'BTN_TR',
        'BTN_SELECT',
        'BTN_START',
        'BTN_THUMBL',
        'BTN_THUMBR',
      ],
      EV_ABS: {
        ABS_X: {
          value: 0,
          min: -32768,
          max: 32767,
          fuzz: 255,
          flat: 4095,
        },
        ABS_Y: {
          value: 0,
          min: -32768,
          max: 32767,
          fuzz: 255,
          flat: 4095,
        },
        ABS_Z: {
          value: 0,
          min: 0,
          max: 1023,
          fuzz: 3,
          flat: 63,
        },
        ABS_RX: {
          value: 0,
          min: -32768,
          max: 32767,
          fuzz: 255,
          flat: 4095,
        },
        ABS_RY: {
          value: 0,
          min: -32768,
          max: 32767,
          fuzz: 255,
          flat: 4095,
        },
        ABS_RZ: {
          value: 0,
          min: 0,
          max: 1023,
          fuzz: 3,
          flat: 63,
        },
        ABS_HAT0X: {
          value: 0,
          min: -1,
          max: 1,
        },
        ABS_HAT0Y: {
          value: 0,
          min: -1,
          max: 1,
        },
      },
      EV_MSC: [
        'MSC_SCAN',
      ],
      EV_FF: [
        'FF_RUMBLE',
        'FF_PERIODIC',
        'FF_SQUARE',
        'FF_TRIANGLE',
        'FF_SINE',
        'FF_GAIN',
      ],
    },
  });
}

function createReader() {
  const inputDevice = new EvdevReader();

  inputDevice.open(DEVICE_PATH, (readerError /* , fd */) => {
    if (readerError) {
      inputDevice.emit('error', readerError);
      return;
    }

    // TODO: should fd be used instead?
    readDeviceCapabilities(DEVICE_PATH, (capabilitiesError, deviceCapabilities) => {
      if (capabilitiesError) {
        inputDevice.emit('error', capabilitiesError);
        return;
      }

      inputDevice.emit('ready', deviceCapabilities);
    });
  });

  // TODO: need to de-register this callback when the inputDevice closes/has an error?
  process.once('exit', () => inputDevice.close());
  // FIXME: work around pigpio's signal "stealing"
  // https://github.com/fivdi/pigpio/issues/6#issuecomment-224058777
  // https://github.com/fivdi/pigpio/blob/master/doc/configuration.md#initialize
  process.once('SIGTERM', () => inputDevice.close());
  process.once('SIGINT', () => inputDevice.close());

  return inputDevice;
}

module.exports = createReader;
