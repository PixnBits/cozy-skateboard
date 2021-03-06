const { EventEmitter } = require('events');

const createReader = require('./input-device');

const inputRepresentationEmitter = new EventEmitter();

const rawValues = {
  rightX: {
    value: 0,
    min: 0,
    max: 0,
  },
  leftZ: {
    value: 0,
    min: 0,
    max: 0,
  },
  rightZ: {
    value: 0,
    min: 0,
    max: 0,
  },
  y: 0,
};

const derivedStates = {
  yToggle: false,
};

function mapValueToRange(rawValue, outputMin, outputMax) {
  // FIXME: handle dead zones
  const { max: inputMax, min: inputMin, value: inputValue } = rawValue;
  return (((inputValue - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin)) + outputMin;
}

function calculateInputRepresentation() {
  const steeringAngle = mapValueToRange(rawValues.rightX, -45, 45);
  const throttleForwardMagnitude = mapValueToRange(rawValues.rightZ, 0, 100);
  const throttleBackwardsMagnitude = mapValueToRange(rawValues.leftZ, 0, 100);

  let throttleMagnitude = 0;
  let throttleDirection = 'S';
  if (throttleForwardMagnitude > 1 && throttleBackwardsMagnitude > 1) {
    throttleDirection = 'S';
    throttleMagnitude = 0;
  } else if (throttleForwardMagnitude > 1) {
    throttleDirection = 'F';
    throttleMagnitude = throttleForwardMagnitude;
  } else if (throttleBackwardsMagnitude > 1) {
    throttleDirection = 'R';
    throttleMagnitude = throttleBackwardsMagnitude;
  }

  let steeringDirection = 'C';
  if (steeringAngle > 2) {
    steeringDirection = 'R';
  } else if (steeringAngle < -2) {
    steeringDirection = 'L';
  }

  return {
    steering: {
      direction: steeringDirection,
      angle: steeringAngle,
    },
    throttle: {
      direction: throttleDirection,
      magnitude: throttleMagnitude,
    },
    accessories: {
      frontLightBar: derivedStates.yToggle,
    },
  };
}

function emitInputRepresentation() {
  inputRepresentationEmitter.emit('representation', calculateInputRepresentation());
}

function setUpInputDevice() {
  let inputDevice;
  try {
    inputDevice = createReader();
  } catch (createReaderError) {
    inputRepresentationEmitter.emit('error', createReaderError);
    // likely no device found, try again in a bit
    setTimeout(setUpInputDevice, 1e3);
    return;
  }

  inputDevice.on('error', (error) => {
    inputRepresentationEmitter.emit('error', error);

    // likely no device found, try again until we find one
    setTimeout(setUpInputDevice, 1e3);
  });

  inputDevice.once('ready', (device) => {
    inputRepresentationEmitter.emit('device', device);
    // console.log('rawValues', rawValues);
    if (device.supportedEvents.EV_ABS.ABS_RX) {
      Object.assign(rawValues.rightX, device.supportedEvents.EV_ABS.ABS_RX);
    }
    if (device.supportedEvents.EV_ABS.ABS_RZ) {
      Object.assign(rawValues.rightZ, device.supportedEvents.EV_ABS.ABS_RZ);
    }
    if (device.supportedEvents.EV_ABS.ABS_Z) {
      Object.assign(rawValues.leftZ, device.supportedEvents.EV_ABS.ABS_Z);
    }

    emitInputRepresentation();
  });

  inputDevice.on('EV_ABS', ({ code, value }) => {
    if (code === 'ABS_RX') {
      rawValues.rightX.value = value;
    } else if (code === 'ABS_Z') {
      rawValues.leftZ.value = value;
    } else if (code === 'ABS_RZ') {
      rawValues.rightZ.value = value;
    } else {
      return;
    }

    emitInputRepresentation();
  });

  inputDevice.on('EV_KEY', ({ code, value }) => {
    const buttonName = code.replace(/^BTN_/, '').toLowerCase();
    const previousValueState = rawValues[buttonName];
    rawValues[buttonName] = value;

    // down or up?
    if (value === 1 && (previousValueState === 0 || previousValueState === undefined)) {
      inputRepresentationEmitter.emit(`keyDown:${buttonName}`);
    } else if (value === 0 && (previousValueState === 1 || previousValueState === undefined)) {
      inputRepresentationEmitter.emit(`keyUp:${buttonName}`);
    }
  });
}

inputRepresentationEmitter.on('keyDown:y', () => {
  derivedStates.yToggle = !derivedStates.yToggle;
  emitInputRepresentation();
});

setUpInputDevice();
module.exports = inputRepresentationEmitter;
