export const RUNNER_DEFAULTS = {
  lives: 3,
  gravity: 2300,
  jumpVelocity: 860,
  slideSec: 0.6,
  quizIntervalSec: 20,
  quizTimeLimitSec: 7,
  obstacleSpawnSec: [1.2, 2.0],
  scorePerSec: 20,
  distancePerSpeed: 0.18,
  baseSpeed: 220,
  maxSpeed: 330,
  speedRampPerSec: 1.3
};

export const ASSETS = {
  bg: [
    './assets/bg/bg_city_park_v1.jpg',
    './assets/bg/bg_fantasy_learning_v1.jpg',
    './assets/bg/bg_indoor_gym_v1.jpg',
    './assets/bg/bg_school_field_v1.jpg'
  ],
  sprites: {
    idle: './assets/sprites/mori_concept_idle_alpha.png',
    run1: './assets/sprites/mori_run_frame1_alpha.png',
    run2: './assets/sprites/mori_run_frame2_alpha.png',
    run3: './assets/sprites/mori_run_frame3_alpha.png',
    jump: './assets/sprites/mori_jump_v1_alpha.png',
    slide: './assets/sprites/mori_slide_v1_alpha.png',
    hit: './assets/sprites/mori_hit_v1_alpha.png',
    cheer: './assets/sprites/mori_cheer_v1_alpha.png'
  }
};
