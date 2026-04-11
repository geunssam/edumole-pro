import { ASSETS } from './config.js';

export class Player {
  constructor(el, groundY, cfg) {
    this.el = el;
    this.groundY = groundY;
    this.cfg = cfg;
    this.x = 120;
    this.y = 0;
    this.vy = 0;
    this.isSliding = false;
    this.slideLeft = 0;
    this.animT = 0;
    this.state = 'idle';
    this._setSprite(ASSETS.sprites.idle);
  }

  jump() {
    if (this.y > 2) return;
    this.vy = this.cfg.jumpVelocity;
    this.state = 'jump';
    this._setSprite(ASSETS.sprites.jump);
  }

  slide() {
    if (this.y > 2) return;
    this.isSliding = true;
    this.slideLeft = this.cfg.slideSec;
    this.state = 'slide';
    this.el.classList.add('slide');
    this._setSprite(ASSETS.sprites.slide);
  }

  hit() {
    this.state = 'hit';
    this._setSprite(ASSETS.sprites.hit);
  }

  cheer() {
    this.state = 'cheer';
    this._setSprite(ASSETS.sprites.cheer);
  }

  resetState() {
    this.state = 'run';
    this._setSprite(ASSETS.sprites.run1);
  }

  update(dt) {
    this.vy -= this.cfg.gravity * dt;
    this.y += this.vy * dt;
    if (this.y < 0) {
      this.y = 0;
      this.vy = 0;
    }

    if (this.isSliding) {
      this.slideLeft -= dt;
      if (this.slideLeft <= 0) {
        this.isSliding = false;
        this.el.classList.remove('slide');
        this.resetState();
      }
    }

    if (!this.isSliding && this.y <= 1 && this.state !== 'hit' && this.state !== 'cheer') {
      this.animT += dt;
      if (this.animT > 0.11) {
        this.animT = 0;
        const frames = [ASSETS.sprites.run1, ASSETS.sprites.run2, ASSETS.sprites.run3];
        const idx = Math.floor((Date.now() / 120) % 3);
        this._setSprite(frames[idx]);
        this.state = 'run';
      }
    }

    this.el.style.bottom = `${this.groundY + this.y}px`;
  }

  getBounds() {
    const width = 58;
    const height = this.isSliding ? 32 : 64;
    return {
      left: this.x + 10,
      right: this.x + 10 + width,
      bottom: this.groundY + this.y,
      top: this.groundY + this.y + height
    };
  }

  _setSprite(src) {
    this.el.style.backgroundImage = `url(${src})`;
  }
}
