const socket = io();

// UI elements
const codeInput = document.getElementById('code');
const nameInput = document.getElementById('name');
const createBtn = document.getElementById('create');
const joinBtn = document.getElementById('join');
const statusEl = document.getElementById('status');
const lobby = document.getElementById('lobby');
const placement = document.getElementById('placement');
const game = document.getElementById('game');
const rotateBtn = document.getElementById('rotate');
const resetBtn = document.getElementById('resetBoard');
const shipListEl = document.getElementById('shipList');
const yourBoardEl = document.getElementById('yourBoard');
const readyBtn = document.getElementById('ready');
const yourBoardView = document.getElementById('yourBoardView');
const oppBoard = document.getElementById('oppBoard');
const turnInfo = document.getElementById('turnInfo');
const messages = document.getElementById('messages');
const eventLog = document.getElementById('eventLog');

let code = null;
let playerId = null;
let myTurn = false;

function short(msg){
  const d = document.createElement('div');
  d.textContent = msg;
  messages.prepend(d);
}

createBtn.onclick = () => {
  code = (codeInput.value || '').trim();
  if (!/^[0-9]{4}$/.test(code)) return alert('Enter a 4-digit code');
  const name = nameInput.value || 'Player';
  socket.emit('create', { code, name }, (res) => {
    if (res.ok) onJoined(); else alert(res.error || 'Could not create');
  });
};
joinBtn.onclick = () => {
  code = (codeInput.value || '').trim();
  if (!/^[0-9]{4}$/.test(code)) return alert('Enter a 4-digit code');
  const name = nameInput.value || 'Player';
  socket.emit('join', { code, name }, (res) => {
    if (res.ok) onJoined(); else alert(res.error || 'Could not join');
  });
};

function onJoined(){
  lobby.classList.add('hidden');
  placement.classList.remove('hidden');
  statusEl.textContent = `Code: ${code}`;
  initPlacement();
}

// Board helpers
function makeEmptyBoard(){
  const b = [];
  for(let r=0;r<10;r++){ b[r] = Array(10).fill(0); }
  return b;
}

// placement
const ships = [5,4,3,3,2];
let placementBoard = makeEmptyBoard();
let placingIndex = 0;
let horizontal = true;

function initPlacement(){
  renderShipList();
  renderYourBoard();
}

function renderShipList(){
  shipListEl.innerHTML = '';
  ships.forEach((len, idx) => {
    const el = document.createElement('div');
    el.className = 'ship-item';
    el.textContent = `Ship ${idx+1}: length ${len}`;
    if (idx === placingIndex) el.style.fontWeight = 'bold';
    shipListEl.appendChild(el);
  });
}

rotateBtn.onclick = () => { horizontal = !horizontal; rotateBtn.textContent = 'Rotate: ' + (horizontal ? 'Horizontal' : 'Vertical'); };
resetBtn.onclick = () => resetPlacementBoard(true);

function renderYourBoard(){
  yourBoardEl.innerHTML = '';
  for(let y=0;y<10;y++){
    for(let x=0;x<10;x++){
      const cell = document.createElement('div');
      cell.className = 'cell' + (placementBoard[y][x] ? ' occupied' : '');
      cell.dataset.x = x; cell.dataset.y = y;
      cell.onclick = () => tryPlace(x,y);
      yourBoardEl.appendChild(cell);
    }
  }
}

function resetPlacementBoard(announce = false){
  placementBoard = makeEmptyBoard();
  placingIndex = 0;
  readyBtn.disabled = true;
  renderShipList();
  renderYourBoard();
  if (announce) short('Board reset');
}

function tryPlace(x,y){
  if (placingIndex >= ships.length) return;
  const len = ships[placingIndex];
  const coords = [];
  for(let i=0;i<len;i++){
    const cx = horizontal ? x + i : x;
    const cy = horizontal ? y : y + i;
    if (cx < 0 || cx >=10 || cy<0 || cy>=10) return alert('Out of bounds');
    if (placementBoard[cy][cx] !== 0) return alert('Overlap');
    coords.push([cx,cy]);
  }
  // place with ship id = placingIndex+1
  coords.forEach(([cx,cy]) => placementBoard[cy][cx] = placingIndex+1);
  placingIndex++;
  renderShipList(); renderYourBoard();
  if (placingIndex === ships.length) readyBtn.disabled = false;
}

readyBtn.onclick = () => {
  socket.emit('place', { board: placementBoard }, (res) => {
    if (res.ok) {
      placement.classList.add('hidden');
      game.classList.remove('hidden');
      short('Board placed, waiting for opponent...');
      // show your board view
      renderYourBoardView();
    }
  });
};

function renderYourBoardView(){
  yourBoardView.innerHTML = '';
  for(let y=0;y<10;y++){
    for(let x=0;x<10;x++){
      const div = document.createElement('div');
      div.className = 'cell' + (placementBoard[y][x] ? ' occupied' : '');
      yourBoardView.appendChild(div);
    }
  }
}

// opponent board
const oppMarkers = {};
function renderOppBoard(){
  oppBoard.innerHTML = '';
  for(let y=0;y<10;y++){
    for(let x=0;x<10;x++){
      const div = document.createElement('div');
      div.className = 'cell';
      const key = `${x},${y}`;
      if (oppMarkers[key] === 'miss') div.classList.add('miss');
      if (oppMarkers[key] === 'hit') div.classList.add('hit');
      div.dataset.x = x; div.dataset.y = y;
      div.onclick = () => fire(x,y);
      oppBoard.appendChild(div);
    }
  }
}

function fire(x,y){
  if (!myTurn) return alert('Not your turn');
  socket.emit('fire', { x, y }, (res) => {
    if (!res.ok) return alert(res.error || 'Error');
    // wait for server 'shot' to reflect
  });
}

// socket events
socket.on('roomUpdate', (data) => {
  statusEl.textContent = `Code: ${code} — Players: ${data.players}`;
});

socket.on('start', ({ starter }) => {
  short('Game started');
  myTurn = (starter === socket.id);
  turnInfo.textContent = myTurn ? 'Your turn' : 'Opponent turn';
  eventLog.classList.remove('hidden');
  renderOppBoard();
});

socket.on('turn', ({ turn }) => {
  myTurn = (turn === socket.id);
  turnInfo.textContent = myTurn ? 'Your turn' : 'Opponent turn';
});

socket.on('shot', ({ shooter, x, y, hit, sunk }) => {
  // shooter fired at (x,y) on opponent board; update appropriate view
  const isMeShooting = (shooter === socket.id);
  if (isMeShooting) {
    // update opponent markers
    oppMarkers[`${x},${y}`] = hit ? 'hit' : 'miss';
    renderOppBoard();
    short(`You fired at ${x},${y} — ${hit ? 'HIT' : 'MISS'}${sunk? ' — SUNK':''}`);
  } else {
    // opponent shot at us — update our board view
    // find element in yourBoardView and mark
    const idx = y*10 + x;
    const cell = yourBoardView.children[idx];
    if (cell) cell.classList.add(hit ? 'hit' : 'miss');
    short(`Opponent fired at ${x},${y} — ${hit ? 'HIT' : 'MISS'}${sunk? ' — SUNK':''}`);
  }
});

socket.on('gameOver', ({ winner }) => {
  if (winner === socket.id) alert('You win!'); else alert('You lose.');
  // reset UI to lobby
  location.reload();
});

// init fields
codeInput.value = '';
nameInput.value = '';
