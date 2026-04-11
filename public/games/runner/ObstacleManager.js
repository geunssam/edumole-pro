export class ObstacleManager {
  constructor(layerEl, stageWidth, groundY, cfg) {
    this.layerEl = layerEl;
    this.stageWidth = stageWidth;
    this.groundY = groundY;
    this.cfg = cfg;
    this.obstacles = [];
    this.spawnLeft = this._spawnInterval();
  }

  reset(stageWidth) {
    this.stageWidth = stageWidth;
    this.obstacles = [];
    this.layerEl.innerHTML = '';
    this.spawnLeft = this._spawnInterval();
  }

  update(dt, speed) {
    this.spawnLeft -= dt;
    if (this.spawnLeft <= 0) {
      this.spawn();
      this.spawnLeft = this._spawnInterval();
    }

    this.obstacles.forEach((o) => {
      o.x -= speed * dt;
      o.el.style.transform = `translateX(${o.x}px)`;
    });

    this.obstacles = this.obstacles.filter((o) => {
      if (o.x < -80) {
        o.el.remove();
        return false;
      }
      return true;
    });
  }

  spawn() {
    const el = document.createElement('div');
    el.className = 'obstacle';
    const width = 32 + Math.random() * 28;
    const height = 42 + Math.random() * 48;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.bottom = `${this.groundY}px`;

    const obstacle = {
      x: this.stageWidth + 40,
      width,
      height,
      el
    };
    el.style.transform = `translateX(${obstacle.x}px)`;
    this.layerEl.appendChild(el);
    this.obstacles.push(obstacle);
  }

  collides(playerBounds) {
    return this.obstacles.some((o) => {
      const left = o.x;
      const right = o.x + o.width;
      const bottom = this.groundY;
      const top = bottom + o.height;
      return !(playerBounds.right < left || playerBounds.left > right || playerBounds.top < bottom || playerBounds.bottom > top);
    });
  }

  _spawnInterval() {
    const [min, max] = this.cfg.obstacleSpawnSec;
    return min + Math.random() * (max - min);
  }
}
