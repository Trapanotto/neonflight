const CONTROL_KEYS = {
  KeyW: 'throttleUp',
  KeyS: 'throttleDown',
  ArrowUp: 'pitchUp',
  ArrowDown: 'pitchDown',
  ArrowLeft: 'rollLeft',
  ArrowRight: 'rollRight',
  ShiftLeft: 'boost',
  ShiftRight: 'boost'
};

const ACTION_KEYS = {
  KeyR: 'restart',
  KeyM: 'mute',
  KeyP: 'pause',
  Escape: 'pause'
};

const CONTROL_NAMES = [
  'throttleUp',
  'throttleDown',
  'pitchUp',
  'pitchDown',
  'rollLeft',
  'rollRight',
  'boost'
];

function createControlState() {
  return Object.fromEntries(CONTROL_NAMES.map((name) => [name, false]));
}

export class InputManager {
  constructor({ onAction } = {}) {
    this.keyboardState = createControlState();
    this.touchState = createControlState();
    this.gamepadState = createControlState();
    this.state = createControlState();

    this.onAction = onAction || (() => {});
    this.touchButtons = [];
    this.previousGamepadButtons = [];

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse || 'ontouchstart' in window) {
      document.body.classList.add('touch');
    }

    this.setupTouchControls();
  }

  handleKeyDown(event) {
    const control = CONTROL_KEYS[event.code];
    if (control) {
      this.keyboardState[control] = true;
      event.preventDefault();
      return;
    }

    const action = ACTION_KEYS[event.code];
    if (action && !event.repeat) {
      this.onAction(action);
    }
  }

  handleKeyUp(event) {
    const control = CONTROL_KEYS[event.code];
    if (control) {
      this.keyboardState[control] = false;
      event.preventDefault();
    }
  }

  handleBlur() {
    this.reset();
  }

  reset() {
    Object.assign(this.keyboardState, createControlState());
    Object.assign(this.touchState, createControlState());
    Object.assign(this.gamepadState, createControlState());
    Object.assign(this.state, createControlState());
    this.previousGamepadButtons = [];
    this.touchButtons.forEach((button) => button.classList.remove('active'));
  }

  setupTouchControls() {
    const buttons = document.querySelectorAll('[data-control]');

    buttons.forEach((button) => {
      const control = button.dataset.control;
      if (!(control in this.touchState) && control !== 'boost') return;

      this.touchButtons.push(button);

      const press = (event) => {
        event.preventDefault();
        this.touchState[control] = true;
        button.classList.add('active');
        if (button.setPointerCapture && event.pointerId !== undefined) {
          try {
            button.setPointerCapture(event.pointerId);
          } catch (error) {
            // Ignore pointer capture failures on older browsers.
          }
        }
      };

      const release = (event) => {
        event.preventDefault();
        this.touchState[control] = false;
        button.classList.remove('active');
      };

      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    });

    document.addEventListener('touchmove', (event) => {
      if (event.target.closest('#touch-controls')) event.preventDefault();
    }, { passive: false });
  }

  updateGamepad() {
    Object.assign(this.gamepadState, createControlState());

    if (!navigator.getGamepads) return;

    const gamepad = Array.from(navigator.getGamepads()).find((pad) => pad && pad.connected);
    if (!gamepad) {
      this.previousGamepadButtons = [];
      return;
    }

    const deadzone = 0.2;
    const leftX = gamepad.axes[0] || 0;
    const leftY = gamepad.axes[1] || 0;
    const throttleUp = gamepad.buttons[7] ? gamepad.buttons[7].value : 0;
    const throttleDown = gamepad.buttons[6] ? gamepad.buttons[6].value : 0;
    const dpadUp = gamepad.buttons[12] && gamepad.buttons[12].pressed;
    const dpadDown = gamepad.buttons[13] && gamepad.buttons[13].pressed;
    const dpadLeft = gamepad.buttons[14] && gamepad.buttons[14].pressed;
    const dpadRight = gamepad.buttons[15] && gamepad.buttons[15].pressed;

    this.gamepadState.rollLeft = leftX < -deadzone || dpadLeft;
    this.gamepadState.rollRight = leftX > deadzone || dpadRight;
    this.gamepadState.pitchUp = leftY < -deadzone || dpadUp;
    this.gamepadState.pitchDown = leftY > deadzone || dpadDown;
    this.gamepadState.throttleUp = throttleUp > 0.15;
    this.gamepadState.throttleDown = throttleDown > 0.15;
    this.gamepadState.boost = Boolean(
      (gamepad.buttons[0] && gamepad.buttons[0].pressed)
      || (gamepad.buttons[5] && gamepad.buttons[5].pressed)
    );

    const startPressed = Boolean(gamepad.buttons[9] && gamepad.buttons[9].pressed);
    const previousStart = Boolean(this.previousGamepadButtons[9]);
    if (startPressed && !previousStart) {
      this.onAction('pause');
    }

    this.previousGamepadButtons = gamepad.buttons.map((button) => button.pressed);
  }

  update() {
    this.updateGamepad();

    for (const control of CONTROL_NAMES) {
      this.state[control] = Boolean(
        this.keyboardState[control]
        || this.touchState[control]
        || this.gamepadState[control]
      );
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }
}
