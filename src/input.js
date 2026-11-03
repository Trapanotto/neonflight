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
  KeyM: 'mute'
};

export class InputManager {
  constructor({ onAction } = {}) {
    this.state = {
      throttleUp: false,
      throttleDown: false,
      pitchUp: false,
      pitchDown: false,
      rollLeft: false,
      rollRight: false,
      boost: false
    };

    this.onAction = onAction || (() => {});
    this.touchButtons = [];

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
      this.state[control] = true;
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
      this.state[control] = false;
      event.preventDefault();
    }
  }

  handleBlur() {
    this.reset();
  }

  reset() {
    Object.keys(this.state).forEach((key) => {
      this.state[key] = false;
    });
    this.touchButtons.forEach((button) => button.classList.remove('active'));
  }

  setupTouchControls() {
    const buttons = document.querySelectorAll('[data-control]');

    buttons.forEach((button) => {
      const control = button.dataset.control;
      if (!(control in this.state) && control !== 'boost') return;

      this.touchButtons.push(button);

      const press = (event) => {
        event.preventDefault();
        this.state[control] = true;
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
        this.state[control] = false;
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

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }
}
