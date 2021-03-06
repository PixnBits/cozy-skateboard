const { Board, Servo, Relay } = require('johnny-five');
const Raspi = require('raspi-io').RaspiIO;

const board = new Board({
  io: new Raspi(),
  repl: false,
});

let readyListeners = [];
let steeringServo;
let throttleServo;
let throttleEnableRelay;
let throttleDirectionRelay;
// accessories
let binaryLightBarRelay;

function addReadyListener(cb) {
  readyListeners.push(cb);
}

function setSteeringAngle(degrees) {
  if (degrees !== 0 && !degrees) {
    return;
  }

  if (degrees < -45 || degrees > 45) {
    throw new Error(`requested steering angle ${degrees} outside bounds of -45 to +45`);
  }
  // TODO: memoize
  if (!steeringServo) {
    throw new Error('steeringServo not ready yet');
  }

  // the direction is inverted
  steeringServo.to(45 - degrees);
}

// S, F, R
function setThrottleDirection(direction) {
  if (!direction) {
    return;
  }

  // TODO: memoize
  if (!throttleDirectionRelay || !throttleEnableRelay) {
    throw new Error('throttleDirectionRelay not ready yet');
  }

  if (direction === 'S') {
    throttleEnableRelay.open();
    return;
  }

  if (direction === 'F') {
    throttleEnableRelay.close();
    throttleDirectionRelay.open();
    return;
  }

  if (direction === 'R') {
    throttleEnableRelay.close();
    throttleDirectionRelay.close();
    return;
  }

  throw new Error(`direction must be S(topped), F(orward), or R(everse), was "${direction}"`);
}

function setThrottleSpeed(magnitude) {
  if (magnitude !== 0 && !magnitude) {
    return;
  }
  // magnitude is 0-100 (note: not a percentage like 0-1)
  // servo expects degrees (0-180), map
  // johnny5 takes care of bounds
  throttleServo.to((180 * magnitude) / 100);
}

function setAccessories({ frontLightBar }) {
  if (frontLightBar === true) {
    binaryLightBarRelay.close();
  } else if (frontLightBar === false) {
    binaryLightBarRelay.open();
  }
}

function updateOutput({ steering, throttle, accessories }) {
  if (steering) {
    setSteeringAngle(steering.angle);
  }

  if (throttle) {
    setThrottleDirection(throttle.direction);
    setThrottleSpeed(throttle.magnitude);
  }

  if (accessories) {
    setAccessories(accessories);
  }
}

function resetOutput() {
  updateOutput({
    steering: {
      angle: 0,
    },
    throttle: {
      direction: 'S',
      magnitude: 0,
    },
    accessories: {
      frontLightBar: false,
    },
  });
}

board.on('ready', () => {
  // first: ensure we disable movement

  // using a relay board that breaks out both Normally Open (NO) & Closed (NC) connections
  // raspi-io starts pins on low, and the relays are triggered high, so disconnected by default
  // this is intentinal for safety
  // using channel 2 for throttleEnableRelay
  throttleEnableRelay = new Relay('GPIO20');
  throttleEnableRelay.open();
  board.on('exit', () => { throttleEnableRelay.open(); });

  // _now_ we can initialize direction, speed, etc.

  // using channel 3 for throttleDirectionRelay
  // throttleEnableRelay/CH2 normally open (NO2) connects to throttleDirectionRelay common (C1)
  // intended to use normally closed (NC1) for forward, normally open (NO1) for reverse
  throttleDirectionRelay = new Relay('GPIO26');
  throttleDirectionRelay.open();
  board.on('exit', () => { throttleDirectionRelay.open(); });

  // non-dimmable light bar
  binaryLightBarRelay = new Relay('GPIO21');
  binaryLightBarRelay.open();
  board.on('exit', () => { binaryLightBarRelay.open(); });

  throttleServo = new Servo({
    controller: 'PCA9685',
    address: 0x40,
    pin: 0,
    range: [0, 180],
    startAt: 0,
  });
  throttleServo.stop();
  board.on('exit', () => { throttleServo.stop(); });

  steeringServo = new Servo({
    controller: 'PCA9685',
    address: 0x40,
    pin: 3,
  });
  steeringServo.stop();
  board.on('exit', () => { steeringServo.stop(); });

  readyListeners.forEach((cb) => setImmediate(cb, null));
  readyListeners = null;
});

board.on('error', (err) => {
  readyListeners.forEach((cb) => setImmediate(cb, err));
  readyListeners = null;
});

module.exports = {
  addReadyListener,
  updateOutput,
  resetOutput,
};
