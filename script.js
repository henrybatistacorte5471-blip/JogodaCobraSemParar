const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const eventStatusEl = document.getElementById('eventStatus');
const upgradeStatusEl = document.getElementById('activeUpgrade');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const restartButton = document.getElementById('restartButton');
const difficultySelect = document.getElementById('difficultySelect');
const themeButton = document.getElementById('themeButton');
const controlButtons = document.querySelectorAll('[data-action]');

const GRID_SIZE = 32;
let CELL_SIZE = 0;
const BASE_DELAY = 120;
const ACCELERATION = 2;
const ENEMY_MOVE_INTERVAL = 3;
const EVENT_DURATION = 10000;
const UPGRADE_DURATION = 9000;
const MAX_ENEMIES = 4;
const UPGRADE_TYPES = ['shield', 'turbo', 'double'];
const EVENT_TYPES = ['fruitStorm', 'enemyRush', 'shieldRain', 'slowField'];

// Variáveis para gestos de toque
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const SWIPE_THRESHOLD = 50; // pixels mínimos para registrar um swipe

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let fruits = [];
let enemies = [];
let upgradeItem = null;
let activeUpgrade = null;
let activeEvent = null;
let score = 0;
let highScore = 0;
let delay = BASE_DELAY;
let lastFrameTime = 0;
let running = false;
let paused = false;
let themeDark = true;
let frameCount = 0;
let lastEventTimestamp = 0;
let nextEventDelay = 12000;
let animationFrameId = null;

function loadHighScore() {
  const saved = Number(window.localStorage.getItem('snakeHighScore') || '0');
  highScore = Number.isFinite(saved) ? saved : 0;
  highScoreEl.textContent = highScore;
}

function saveHighScore() {
  window.localStorage.setItem('snakeHighScore', String(highScore));
}

function updateCanvasSize() {
  const container = canvas.parentElement;
  const size = Math.min(container.clientWidth, window.innerHeight - 220);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  CELL_SIZE = size / GRID_SIZE;
}

function getRandomPosition() {
  while (true) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    const collision = snake.some(segment => segment.x === x && segment.y === y)
      || fruits.some(item => item.x === x && item.y === y)
      || enemies.some(item => item.x === x && item.y === y)
      || (upgradeItem && upgradeItem.x === x && upgradeItem.y === y);
    if (!collision) {
      return { x, y };
    }
  }
}

function resetGame() {
  updateCanvasSize();

  const center = Math.floor(GRID_SIZE / 2);
  snake = [
    { x: center + 2, y: center },
    { x: center + 1, y: center },
    { x: center, y: center }
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  delay = Number(difficultySelect.value);
  fruits = [];
  enemies = [];
  upgradeItem = null;
  activeUpgrade = null;
  activeEvent = null;
  frameCount = 0;
  lastEventTimestamp = performance.now();
  nextEventDelay = 12000;

  spawnFruit();
  spawnEnemies(3);
  spawnUpgradeItem();
  running = true;
  paused = false;
  updatePanel();
  hideOverlay();
  pauseButton.textContent = 'Pausar';
  startLoop();
}

function spawnFruit(count = 1) {
  for (let i = 0; i < count; i++) {
    fruits.push(getRandomPosition());
  }
}

function spawnEnemies(amount) {
  for (let i = 0; i < amount; i++) {
    enemies.push({
      ...getRandomPosition(),
      dir: getRandomDirection()
    });
  }
}

function spawnUpgradeItem() {
  if (upgradeItem) return;
  if (Math.random() < 0.5) {
    upgradeItem = {
      ...getRandomPosition(),
      type: UPGRADE_TYPES[Math.floor(Math.random() * UPGRADE_TYPES.length)]
    };
  }
}

function getRandomDirection() {
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
  return directions[Math.floor(Math.random() * directions.length)];
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, canvas.height / (window.devicePixelRatio || 1));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(canvas.width / (window.devicePixelRatio || 1), i * CELL_SIZE);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height / (window.devicePixelRatio || 1));
  gradient.addColorStop(0, '#081023');
  gradient.addColorStop(1, '#10182f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
}

function drawFruits() {
  fruits.forEach((fruit) => {
    ctx.fillStyle = '#ff5c70';
    ctx.shadowColor = 'rgba(255, 92, 112, 0.65)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(
      fruit.x * CELL_SIZE + CELL_SIZE / 2,
      fruit.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE * 0.38,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawUpgrade() {
  if (!upgradeItem) return;
  const colors = {
    shield: '#7ce3ff',
    turbo: '#ffd86b',
    double: '#f58cff'
  };
  ctx.fillStyle = colors[upgradeItem.type] || '#ffffff';
  ctx.shadowColor = `${ctx.fillStyle}80`;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(
    upgradeItem.x * CELL_SIZE + 6,
    upgradeItem.y * CELL_SIZE + 6,
    CELL_SIZE - 12,
    CELL_SIZE - 12,
    8
  );
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    ctx.fillStyle = '#ff9b5c';
    ctx.shadowColor = 'rgba(255, 155, 92, 0.35)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(
      enemy.x * CELL_SIZE + 4,
      enemy.y * CELL_SIZE + 4,
      CELL_SIZE - 8,
      CELL_SIZE - 8,
      10
    );
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawEventBadge() {
  if (!activeEvent) return;
  ctx.fillStyle = 'rgba(86, 124, 255, 0.12)';
  ctx.fillRect(14, canvas.height / (window.devicePixelRatio || 1) - 60, 260, 46);
  ctx.fillStyle = '#dbeafe';
  ctx.font = '600 15px Inter, system-ui';
  ctx.fillText(`Evento ativo: ${eventLabel(activeEvent.type)}`, 24, canvas.height / (window.devicePixelRatio || 1) - 36);
  ctx.fillText(`Tempo restante: ${Math.ceil((activeEvent.endTime - performance.now()) / 1000)}s`, 24, canvas.height / (window.devicePixelRatio || 1) - 16);
}

function eventLabel(type) {
  return {
    fruitStorm: 'Tempestade de frutas',
    enemyRush: 'Ataque de inimigos',
    shieldRain: 'Chuva de escudos',
    slowField: 'Campo lento'
  }[type] || 'Evento';
}

function drawSnake() {
  snake.forEach((segment, index) => {
    const isHead = index === 0;
    const progress = 1 - index / snake.length;
    const fill = isHead
      ? '#b7ff93'
      : `rgba(107, 242, 143, ${Math.max(0.25, progress)})`;

    ctx.fillStyle = fill;
    ctx.shadowColor = isHead ? 'rgba(183, 255, 147, 0.5)' : 'transparent';
    ctx.shadowBlur = isHead ? 16 : 0;
    ctx.beginPath();
    ctx.roundRect(
      segment.x * CELL_SIZE + 2,
      segment.y * CELL_SIZE + 2,
      CELL_SIZE - 4,
      CELL_SIZE - 4,
      10
    );
    ctx.fill();
    if (!isHead) {
      ctx.shadowBlur = 0;
    }
  });
}

function drawScoreOverlay() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fillRect(14, 14, 260, 62);
  ctx.fillStyle = '#dbeafe';
  ctx.font = '600 16px Inter, system-ui';
  ctx.fillText('Nível: ' + getDifficultyName(), 28, 34);
  ctx.fillText('Velocidade: ' + Math.round(1000 / delay), 28, 54);
  ctx.fillText(`Inimigos: ${enemies.length}`, 140, 34);
  ctx.fillText(`Upgrades: ${activeUpgrade ? upgradeLabel(activeUpgrade.type) : 'Normal'}`, 140, 54);
}

function upgradeLabel(type) {
  return {
    shield: 'Escudo',
    turbo: 'Turbo',
    double: 'Pontos x2'
  }[type] || 'Normal';
}

function getDifficultyName() {
  const value = Number(difficultySelect.value);
  if (value >= 150) return 'Fácil';
  if (value >= 100) return 'Médio';
  return 'Difícil';
}

function updatePanel() {
  scoreEl.textContent = score;
  highScoreEl.textContent = highScore;
  eventStatusEl.textContent = activeEvent ? eventLabel(activeEvent.type) : 'Nenhum';
  upgradeStatusEl.textContent = activeUpgrade ? upgradeLabel(activeUpgrade.type) : 'Normal';
}

function checkSnakeCollision(head) {
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    return true;
  }
  if (snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y)) {
    return true;
  }
  return false;
}

function checkEnemyCollision(head) {
  return enemies.some(enemy => enemy.x === head.x && enemy.y === head.y);
}

function pickFruitAt(head) {
  const index = fruits.findIndex(fruit => fruit.x === head.x && fruit.y === head.y);
  if (index >= 0) {
    fruits.splice(index, 1);
    return true;
  }
  return false;
}

function pickUpgradeAt(head) {
  if (!upgradeItem) return false;
  if (upgradeItem.x === head.x && upgradeItem.y === head.y) {
    activeUpgrade = {
      type: upgradeItem.type,
      endTime: performance.now() + UPGRADE_DURATION
    };
    upgradeItem = null;
    return true;
  }
  return false;
}

function moveEnemies() {
  enemies = enemies.map((enemy) => {
    const next = { x: enemy.x + enemy.dir.x, y: enemy.y + enemy.dir.y };
    if (next.x < 0 || next.x >= GRID_SIZE || next.y < 0 || next.y >= GRID_SIZE) {
      enemy.dir = getRandomDirection();
      return { ...enemy };
    }
    if (snake.some(segment => segment.x === next.x && segment.y === next.y)) {
      enemy.dir = getRandomDirection();
      return { ...enemy };
    }
    if (fruits.some(fruit => fruit.x === next.x && fruit.y === next.y) || (upgradeItem && upgradeItem.x === next.x && upgradeItem.y === next.y)) {
      enemy.dir = getRandomDirection();
      return { ...enemy };
    }
    if (Math.random() < 0.2) {
      enemy.dir = getRandomDirection();
    }
    return { ...enemy, x: next.x, y: next.y };
  });
}

function activateEvent(type) {
  activeEvent = { type, endTime: performance.now() + EVENT_DURATION };
  if (type === 'fruitStorm') {
    spawnFruit(4);
  }
  if (type === 'enemyRush') {
    spawnEnemies(2);
  }
  if (type === 'shieldRain') {
    for (let i = 0; i < 2; i++) {
      const pos = getRandomPosition();
      fruits.push(pos);
    }
    if (!upgradeItem) {
      upgradeItem = { ...getRandomPosition(), type: 'shield' };
    }
  }
  if (type === 'slowField') {
    delay = Math.min(delay + 40, 240);
  }
  nextEventDelay = 18000 + Math.random() * 15000;
}

function deactivateEvent() {
  if (!activeEvent) return;
  if (activeEvent.type === 'slowField') {
    delay = Number(difficultySelect.value);
  }
  activeEvent = null;
}

function deactivateUpgrade() {
  activeUpgrade = null;
}

function safeIncrementScore(amount) {
  const multiplier = activeUpgrade?.type === 'double' ? 2 : 1;
  score += amount * multiplier;
  if (score > highScore) {
    highScore = score;
    saveHighScore();
  }
}

function tick() {
  frameCount += 1;
  if (activeUpgrade && performance.now() >= activeUpgrade.endTime) {
    deactivateUpgrade();
  }
  if (activeEvent && performance.now() >= activeEvent.endTime) {
    deactivateEvent();
  }
  if (performance.now() - lastEventTimestamp >= nextEventDelay) {
    activateEvent(EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]);
    lastEventTimestamp = performance.now();
  }

  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  const collisionWithWallOrSelf = checkSnakeCollision(head);
  if (collisionWithWallOrSelf) {
    if (activeUpgrade?.type === 'shield') {
      deactivateUpgrade();
    } else {
      endGame();
      return;
    }
  }

  const collisionWithEnemy = checkEnemyCollision(head);
  if (collisionWithEnemy) {
    if (activeUpgrade?.type === 'shield') {
      deactivateUpgrade();
    } else {
      endGame();
      return;
    }
  }

  snake.unshift(head);

  const ateFruit = pickFruitAt(head);
  const pickedUpgrade = pickUpgradeAt(head);

  if (ateFruit) {
    safeIncrementScore(1);
    if (activeEvent?.type === 'fruitStorm') {
      safeIncrementScore(1);
    }
    delay = Math.max(45, delay - ACCELERATION);
    spawnFruit();
    if (Math.random() < 0.35) {
      spawnUpgradeItem();
    }
  }

  if (!ateFruit && !pickedUpgrade) {
    snake.pop();
  }

  if (frameCount % ENEMY_MOVE_INTERVAL === 0) {
    moveEnemies();
  }

  if (upgradeItem && Math.random() < 0.01) {
    upgradeItem = null;
  }

  if (!upgradeItem && Math.random() < 0.03) {
    spawnUpgradeItem();
  }

  if (enemies.length < MAX_ENEMIES && Math.random() < 0.008) {
    spawnEnemies(1);
  }

  updatePanel();
}

function render() {
  drawBackground();
  drawGrid();
  drawFruits();
  drawUpgrade();
  drawEnemies();
  drawSnake();
  drawScoreOverlay();
  drawEventBadge();
}

function gameLoop(timestamp) {
  if (!running) {
    return;
  }
  if (!paused) {
    if (!lastFrameTime) {
      lastFrameTime = timestamp;
    }
    if (timestamp - lastFrameTime >= delay) {
      lastFrameTime = timestamp;
      tick();
    }
    render();
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;
  if (score > highScore) {
    highScore = score;
    saveHighScore();
  }
  updatePanel();
  showOverlay('Fim de jogo', `Você fez ${score} ponto(s). Clique em reiniciar para jogar novamente.`);
}

function showOverlay(title, message) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function alignDirection(x, y) {
  if (direction.x === -x && direction.y === -y) return;
  nextDirection = { x, y };
}

// ===== SUPORTE A GESTOS E TOQUE =====

/**
 * Detecta swipes no canvas para controlar a cobra
 */
function handleSwipe() {
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  const absDiffX = Math.abs(diffX);
  const absDiffY = Math.abs(diffY);

  // Só registra swipe se passou do threshold
  if (absDiffX < SWIPE_THRESHOLD && absDiffY < SWIPE_THRESHOLD) {
    return;
  }

  // Determina qual direção tem o maior movimento
  if (absDiffX > absDiffY) {
    // Swipe horizontal
    if (diffX > 0) {
      alignDirection(1, 0); // direita
    } else {
      alignDirection(-1, 0); // esquerda
    }
  } else {
    // Swipe vertical
    if (diffY > 0) {
      alignDirection(0, 1); // baixo
    } else {
      alignDirection(0, -1); // cima
    }
  }
}

/**
 * Inicia o rastreamento de toque
 */
canvas.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0].clientX;
  touchStartY = event.changedTouches[0].clientY;
}, false);

/**
 * Atualiza a posição final do toque
 */
canvas.addEventListener('touchmove', (event) => {
  touchEndX = event.changedTouches[0].clientX;
  touchEndY = event.changedTouches[0].clientY;
}, false);

/**
 * Detecta o fim do swipe e alinha a direção
 */
canvas.addEventListener('touchend', (event) => {
  handleSwipe();
}, false);

/**
 * Melhora a responsividade dos botões de controle no mobile
 * Adiciona feedback visual ao toque
 */
controlButtons.forEach((button) => {
  button.addEventListener('touchstart', (e) => {
    button.style.transform = 'scale(0.95)';
    button.style.opacity = '0.8';
  });

  button.addEventListener('touchend', (e) => {
    button.style.transform = 'scale(1)';
    button.style.opacity = '1';
  });

  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'up') alignDirection(0, -1);
    if (action === 'down') alignDirection(0, 1);
    if (action === 'left') alignDirection(-1, 0);
    if (action === 'right') alignDirection(1, 0);
  });
});

/**
 * Melhora responsividade dos botões secundários
 */
[startButton, pauseButton, restartButton, themeButton].forEach((button) => {
  if (!button) return;
  
  button.addEventListener('touchstart', (e) => {
    button.style.transform = 'scale(0.95)';
  });

  button.addEventListener('touchend', (e) => {
    button.style.transform = 'scale(1)';
  });
});

// Listeners de teclado (mantém suporte desktop)
window.addEventListener('keydown', (event) => {
  const keysToBlock = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (keysToBlock.includes(event.key)) {
    event.preventDefault();
  }

  if (!running && event.key === 'Enter') {
    resetGame();
    return;
  }
  if (event.key === 'ArrowUp') alignDirection(0, -1);
  if (event.key === 'ArrowDown') alignDirection(0, 1);
  if (event.key === 'ArrowLeft') alignDirection(-1, 0);
  if (event.key === 'ArrowRight') alignDirection(1, 0);
  if (event.key.toLowerCase() === 'p' && running) {
    togglePause();
  }
});

startButton.addEventListener('click', () => {
  resetGame();
});

pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', () => {
  resetGame();
});

difficultySelect.addEventListener('change', () => {
  delay = Number(difficultySelect.value);
});

themeButton.addEventListener('click', () => {
  themeDark = !themeDark;
  document.documentElement.style.setProperty(
    'background',
    themeDark
      ? 'radial-gradient(circle at top, rgba(56, 118, 255, 0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(255, 96, 165, 0.12), transparent 25%), #0d1220'
      : 'radial-gradient(circle at top, rgba(255, 184, 61, 0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(110, 232, 255, 0.12), transparent 25%), #141216'
  );
});

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseButton.textContent = paused ? 'Continuar' : 'Pausar';
  if (!paused) {
    lastFrameTime = performance.now();
  }
}

function startLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  lastFrameTime = 0;
  animationFrameId = requestAnimationFrame(gameLoop);
}

function init() {
  loadHighScore();
  updateCanvasSize();
  resetGame();
  showOverlay('Bem-vindo', 'Pressione Iniciar jogo para começar.');
  render();
}

window.addEventListener('resize', () => {
  updateCanvasSize();
});

init();
