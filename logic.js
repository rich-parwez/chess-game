let currentTurn = 'W'; // 'W' untuk White, 'B' untuk Black
let selectedSquare = null;
let legalTargets = [];  // kotak tujuan yang valid untuk bidak terpilih
let lastMove = null;    // { from, to } untuk menandai langkah terakhir
let gameOver = false;
let captured = { W: [], B: [] }; // bidak yang sudah dimakan, dikelompokkan per warna
let startingLayout = {};         // posisi awal, dipakai saat reset

const allBoxes = document.querySelectorAll('.box');


function getPiece(box) {
    return box.dataset.piece || '';
}

function setPiece(box, piece) {
    if (piece) {
        box.dataset.piece = piece;
    } else {
        delete box.dataset.piece;
    }
}

function getTeam(box) {
    return getPiece(box).charAt(0); // 'W' atau 'B'
}

function getRank(box) {
    return parseInt(box.id.charAt(1)); // Digit pertama setelah 'b'
}

function getFile(box) {
    return parseInt(box.id.slice(-1)); // Digit terakhir
}

function getBox(rank, file) {
    if (rank < 1 || rank > 8 || file < 1 || file > 8) return null;
    return document.getElementById(`b${rank}0${file}`);
}

function enemyOf(team) {
    return team === 'W' ? 'B' : 'W';
}


function render() {
    let kingInCheck = isInCheck(currentTurn) ? findKing(currentTurn) : null;

    allBoxes.forEach(box => {
        let piece = getPiece(box);
        let rank = getRank(box);
        let file = getFile(box);

        let html = '';
        if (piece) {
            let imgClass = piece.includes('pawn') ? 'all-img all-pawn' : 'all-img';
            html += `<img class='${imgClass}' src="${piece}.png" alt="${piece}">`;
        }

        if (file === 1) html += `<span class="coord coord-rank">${rank}</span>`;
        if (rank === 1) html += `<span class="coord coord-file">${'abcdefgh'[file - 1]}</span>`;
        box.innerHTML = html;

        box.className = 'box ' + ((rank + file) % 2 === 0 ? 'dark' : 'light');
        if (lastMove && (box === lastMove.from || box === lastMove.to)) box.classList.add('last-move');
        if (box === selectedSquare) box.classList.add('selected');
        if (box === kingInCheck) box.classList.add('in-check');
        if (legalTargets.includes(box)) {
            box.classList.add(piece ? 'capture-target' : 'move-target');
        }

        let clickable = !gameOver && (getTeam(box) === currentTurn || legalTargets.includes(box));
        box.style.cursor = clickable ? 'pointer' : 'default';
    });
}

function renderCaptured() {
    ['W', 'B'].forEach(team => {
        document.getElementById(`captured-${team}`).innerHTML =
            captured[team].map(p => `<img src="${p}.png" alt="${p}">`).join('');
    });
}

function updateStatus() {
    let panels = { W: document.getElementById('panel-W'), B: document.getElementById('panel-B') };
    let hasMove = hasAnyLegalMove(currentTurn);
    let inCheck = isInCheck(currentTurn);

    ['W', 'B'].forEach(team => {
        panels[team].className = 'side-panel';
        panels[team].querySelector('.side-note').innerText = '';
    });

    if (!hasMove && inCheck) {
        gameOver = true;
        panels[enemyOf(currentTurn)].classList.add('winner');
        panels[enemyOf(currentTurn)].querySelector('.side-note').innerText = 'Wins!';
        panels[currentTurn].classList.add('loser');
        panels[currentTurn].querySelector('.side-note').innerText = 'Checkmate';
    } else if (!hasMove) {
        gameOver = true;
        ['W', 'B'].forEach(team => {
            panels[team].classList.add('loser');
            panels[team].querySelector('.side-note').innerText = 'Draw';
        });
    } else {
        let panel = panels[currentTurn];
        panel.classList.add('active');
        panel.querySelector('.side-note').innerText = inCheck ? 'Check!' : 'Your move';
        if (inCheck) panel.classList.add('in-check');
    }
}


function getPossibleMoves(box, forAttack = false) {
    let piece = getPiece(box);
    let team = getTeam(box);
    let rank = getRank(box);
    let file = getFile(box);
    let moves = [];

    function tryAdd(r, f) {
        let target = getBox(r, f);
        if (!target) return false;
        let targetTeam = getTeam(target);
        if (targetTeam !== team) moves.push(target);
        return targetTeam === '';
    }

    function slide(directions) {
        directions.forEach(([dr, df]) => {
            for (let i = 1; i < 8; i++) {
                if (!tryAdd(rank + dr * i, file + df * i)) break; // berhenti jika terhalang
            }
        });
    }

    if (piece.endsWith('pawn')) {
        let direction = team === 'W' ? 1 : -1;
        let startRank = team === 'W' ? 2 : 7;

        [-1, 1].forEach(offset => {
            let target = getBox(rank + direction, file + offset);
            if (!target) return;
            if (forAttack || (getPiece(target) && getTeam(target) !== team)) moves.push(target);
        });

        if (!forAttack) {
            let forward = getBox(rank + direction, file);
            if (forward && !getPiece(forward)) {
                moves.push(forward);

                let doubleForward = getBox(rank + direction * 2, file);
                if (rank === startRank && doubleForward && !getPiece(doubleForward)) {
                    moves.push(doubleForward);
                }
            }
        }
    }

    if (piece.endsWith('knight')) {
        [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]
            .forEach(([dr, df]) => tryAdd(rank + dr, file + df));
    }

    if (piece.endsWith('king')) {
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
            .forEach(([dr, df]) => tryAdd(rank + dr, file + df));
    }

    if (piece.endsWith('rook') || piece.endsWith('queen')) {
        slide([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    }

    if (piece.endsWith('bishop') || piece.endsWith('queen')) {
        slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    }

    return moves;
}


function findKing(team) {
    return [...allBoxes].find(box => getPiece(box) === `${team}king`);
}

function isInCheck(team) {
    let king = findKing(team);
    let enemy = enemyOf(team);
    return [...allBoxes].some(box =>
        getTeam(box) === enemy && getPossibleMoves(box, true).includes(king)
    );
}

function getLegalMoves(box) {
    let team = getTeam(box);
    let piece = getPiece(box);

    return getPossibleMoves(box).filter(target => {
        let targetPiece = getPiece(target);

        setPiece(target, piece);
        setPiece(box, '');
        let safe = !isInCheck(team);
        setPiece(box, piece);
        setPiece(target, targetPiece);

        return safe;
    });
}

function hasAnyLegalMove(team) {
    return [...allBoxes].some(box => getTeam(box) === team && getLegalMoves(box).length > 0);
}


function selectSquare(box) {
    selectedSquare = box;
    legalTargets = getLegalMoves(box);
    render();
}

function clearSelection() {
    selectedSquare = null;
    legalTargets = [];
    render();
}

function movePiece(from, to) {
    let piece = getPiece(from);

    if (getPiece(to)) {
        let victim = getPiece(to);
        captured[victim.charAt(0)].push(victim);
    }

    let lastRank = currentTurn === 'W' ? 8 : 1;
    if (piece.endsWith('pawn') && getRank(to) === lastRank) {
        piece = `${currentTurn}queen`;
    }

    setPiece(to, piece);
    setPiece(from, '');
    lastMove = { from, to };

    selectedSquare = null;
    legalTargets = [];
    currentTurn = enemyOf(currentTurn);

    renderCaptured();
    updateStatus();
    render();
}

function handleClick(box) {
    if (gameOver) return;

    if (getTeam(box) === currentTurn) {
        if (box === selectedSquare) {
            clearSelection(); // klik lagi = batalkan pilihan
        } else {
            selectSquare(box);
        }
        return;
    }

    if (selectedSquare && legalTargets.includes(box)) {
        movePiece(selectedSquare, box);
        return;
    }

    if (selectedSquare) clearSelection();
}


function setupBoard() {
    allBoxes.forEach(box => {
        let text = box.innerText.trim();
        startingLayout[box.id] = text;
        setPiece(box, text);
    });
}

function resetGame() {
    allBoxes.forEach(box => setPiece(box, startingLayout[box.id]));
    currentTurn = 'W';
    selectedSquare = null;
    legalTargets = [];
    lastMove = null;
    gameOver = false;
    captured = { W: [], B: [] };

    renderCaptured();
    updateStatus();
    render();
}

allBoxes.forEach(box => box.addEventListener('click', () => handleClick(box)));
document.getElementById('reset-btn').addEventListener('click', resetGame);

setupBoard();
updateStatus();
render();