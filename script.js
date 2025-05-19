document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const config = {
        board: { width: 10, height: 20 },
        touch: {
            dragThreshold: 15,       // Min distance (px) for a touch to be considered a drag for rotation cancellation
            moveThresholdRatio: 0.5, // Ratio of blockSize for horizontal piece movement sensitivity. Lower = more sensitive.
            swipeDownThreshold: 50,  // Min vertical distance (px) for a swipe down (hard drop)
            tapTimeout: 200          // Max duration (ms) for a touch to be considered a tap (for rotation)
        },
        gameplay: {
            baseSpeedMs: 1000,
            speedMultiplier: 1.2,
            minSpeedMs: 50,
            linesPerLevel: 4
        }
    };

    // --- Tetromino Data ---
    const tetrominoes = {
        shapes: [ /* I */ [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], /* J */ [[1,0,0],[1,1,1],[0,0,0]], /* L */ [[0,0,1],[1,1,1],[0,0,0]], /* O */ [[1,1],[1,1]], /* S */ [[0,1,1],[1,1,0],[0,0,0]], /* T */ [[0,1,0],[1,1,1],[0,0,0]], /* Z */ [[1,1,0],[0,1,1],[0,0,0]] ],
        //colors: ["#00f0f0", "#0000f0", "#f0a000", "#f0f000", "#00f000", "#a000f0", "#f00000"],
        colors: ["#00f0f0", "#00f0f0", "#00f0f0", "#00f0f0", "#00f0f0", "#00f0f0", "#00f0f0"],
        images: ['image1.png','image2.png','image3.png','image4.png','image5.png','image6.png','image7.png']
    };

    // --- Game State ---
    const game = {
        board: [], score: 0, lines: 0, level: 1,
        currentPiece: null, nextPiece: null,
        currentX: 0, currentY: 0, blockSize: 20,
        interval: null, isPaused: false, isGameOver: false, gameStarted: false,
        currentPlayerName: '',
        pieceBag: []
    };

    // --- DOM Elements ---
    const elements = {
        body: document.body,
        startScreen: document.getElementById('start-screen'),
        leaderboardScreen: document.getElementById('leaderboard-screen'),
        gameArea: document.getElementById('game-area'),
        playerNameInput: document.getElementById('player-name-input'),
        nameError: document.getElementById('name-error'),
        startGameButton: document.getElementById('start-game-button'),
        viewLeaderboardButton: document.getElementById('view-leaderboard-button'),
        highScoreList: document.getElementById('high-score-list'),
        leaderboardTitle: document.getElementById('leaderboard-title'),
        leaderboardMessage: document.getElementById('leaderboard-message'),
        leaderboardActionButtons: document.getElementById('leaderboard-action-buttons'),
        leaderboardTryAgainButton: document.getElementById('leaderboard-try-again-button'),
        leaderboardResetScoresButton: document.getElementById('leaderboard-reset-scores-button'),
        leaderboardMainMenuButton: document.getElementById('leaderboard-main-menu-button'),
        gameAreaWrapper: document.getElementById('game-area-wrapper'),
        board: document.getElementById('board'),
        nextPieceContainer: document.getElementById('next-piece-container'),
        nextPiece: document.getElementById('next-piece'),
        statsPanel: document.getElementById('stats-panel'),
        score: document.getElementById('score'),
        lines: document.getElementById('lines'),
        level: document.getElementById('level'),
        gameOverOriginalDisplay: document.getElementById('game-over-original-display'),
        gameOverPlayer: document.getElementById('game-over-player'),
        finalScore: document.getElementById('final-score')
    };

    // --- Touch State ---
    const touch = { 
        startX: 0, startY: 0,       // Initial touch point for differentiating tap/swipe
        currentX: 0,                 // Last X-coordinate where a piece move was processed or touch started
        startTime: 0, 
        isDragging: false,           // True if a drag operation is in progress (cancels tap)
        isSwipedDown: false,         // True if a hard drop swipe occurred
        movedHorizontally: false     // True if any horizontal piece movement occurred in the current touch sequence
    };

    // --- High Score Logic ---
    const HIGH_SCORE_KEY = 'tetrisHighScores';
    const MAX_HIGH_SCORES = 10;

    function getHighScores() {
        const scoresJSON = localStorage.getItem(HIGH_SCORE_KEY);
        try {
            const scores = scoresJSON ? JSON.parse(scoresJSON) : [];
            return Array.isArray(scores) ? scores : [];
        } catch (e) {
            console.error("Error parsing high scores from localStorage", e);
            return [];
        }
    }

    function saveHighScores(scores) {
        if (!Array.isArray(scores)) {
            console.error("Attempted to save non-array as high scores:", scores);
            return;
        }
        const sortedScores = scores
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_HIGH_SCORES);
        try {
            localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(sortedScores));
        } catch (e) {
            console.error("Error saving high scores to localStorage:", e);
        }
    }

    function addNewHighScore(newEntry) {
        if (!newEntry || typeof newEntry.name !== 'string' || typeof newEntry.score !== 'number' || !Number.isFinite(newEntry.score)) {
            return;
        }
        const scores = getHighScores();
        scores.push(newEntry);
        saveHighScores(scores);
    }

    function displayHighScores() {
        if (!elements.highScoreList) return;
        const scores = getHighScores();
        elements.highScoreList.innerHTML = '';
        if (scores.length === 0) {
            elements.highScoreList.innerHTML = '<li>No high scores yet!</li>';
        } else {
            scores.forEach((entry, index) => {
                const listItem = document.createElement('li');
                const name = entry.name || 'Anonymous';
                const scoreVal = (typeof entry.score === 'number') ? entry.score : '?';
                listItem.textContent = `#${index + 1}: ${name} - ${scoreVal}`;
                elements.highScoreList.appendChild(listItem);
            });
        }
    }

    // --- Screen Management ---
    function showScreen(screenElement) {
        elements.startScreen?.classList.add('hidden');
        elements.startScreen?.classList.remove('active');
        elements.leaderboardScreen?.classList.add('hidden');
        elements.leaderboardScreen?.classList.remove('active');
        elements.gameArea?.classList.add('hidden');
        if (screenElement) {
            screenElement.classList.remove('hidden');
            screenElement.classList.add('active');
        } else {
            console.error("Attempted to show an invalid screen");
        }
    }

    // --- Core Game Logic Functions ---
    function fillAndShuffleBag() {
        game.pieceBag = [];
        for (let i = 0; i < tetrominoes.shapes.length; i++) game.pieceBag.push(i);
        for (let i = game.pieceBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [game.pieceBag[i], game.pieceBag[j]] = [game.pieceBag[j], game.pieceBag[i]];
        }
    }

    function createPiece() {
        if (game.pieceBag.length === 0) fillAndShuffleBag();
        const index = game.pieceBag.pop();
        if (!tetrominoes?.shapes?.[index] || !tetrominoes.images?.[index] || !tetrominoes.colors?.[index]) {
             console.error(`CreatePiece Fail: Invalid tetromino data for index ${index}.`);
             return null;
        }
        const matrixCopy = JSON.parse(JSON.stringify(tetrominoes.shapes[index]));
        return { shape: index, matrix: matrixCopy, image: tetrominoes.images[index], color: tetrominoes.colors[index] };
    }

    function initBoard() {
        if (!config?.board?.height || !config?.board?.width) { 
            console.error("initBoard failed: config.board dimensions invalid."); game.board = []; return; 
        }
        game.board = Array(config.board.height).fill(null).map(() => Array(config.board.width).fill(0));
        // Clear visual blocks from the board display. Grid is handled by createGrid.
        if (elements.board) {
            const existingBlocks = elements.board.querySelectorAll('.block, .ghost-block');
            existingBlocks.forEach(block => block.remove());
        }
    }

    function getSpeed() {
        const speed = config.gameplay.baseSpeedMs / Math.pow(config.gameplay.speedMultiplier, game.level - 1);
        return Math.max(config.gameplay.minSpeedMs, Math.round(speed));
    }

    function resetPiecePosition() {
        if (!game.currentPiece?.matrix || !config?.board) { console.error("ResetPos Fail: Missing data"); return; }
        const pieceWidth = game.currentPiece.matrix[0]?.length || 0;
        game.currentX = Math.floor(config.board.width / 2) - Math.floor(pieceWidth / 2);
        game.currentY = 0;
        let topRowOffset = 0;
        for (let y = 0; y < game.currentPiece.matrix.length; y++) {
            if (game.currentPiece.matrix[y].some(cell => cell !== 0)) break;
            topRowOffset++;
        }
        game.currentY -= topRowOffset;
    }

    function isCollision(matrix, x, y) {
        if (!matrix || !config?.board || !game.board) return true;
        for (let row = 0; row < matrix.length; row++) {
            if (!matrix[row]) continue;
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col]) {
                    const boardX = x + col; const boardY = y + row;
                    if (boardX < 0 || boardX >= config.board.width || boardY >= config.board.height) return true;
                    if (boardY >= 0 && game.board[boardY]?.[boardX]) return true;
                }
            }
        }
        return false;
    }

    function movePiece(direction) {
        if (game.isPaused || game.isGameOver || !game.currentPiece) return false;
        const newX = game.currentX + direction;
        if (!isCollision(game.currentPiece.matrix, newX, game.currentY)) {
            game.currentX = newX;
            draw(); // Redraw after successful move
            return true;
        }
        return false;
    }

    function moveDown() {
        if (game.isPaused || game.isGameOver || !game.currentPiece) return;
        if (!isCollision(game.currentPiece.matrix, game.currentX, game.currentY + 1)) {
            game.currentY++;
            draw();
        } else {
            placePiece();
            checkLines();
            game.currentPiece = game.nextPiece;
            game.nextPiece = createPiece();
            if (!game.currentPiece || !game.nextPiece) { console.error("moveDown ERROR: Failed create new/next piece. Ending."); endGame(); return; }
            if (!game.currentPiece.matrix) { console.error("moveDown ERROR: New piece has no matrix. Ending."); endGame(); return; }
            resetPiecePosition();
            if (isCollision(game.currentPiece.matrix, game.currentX, game.currentY)) {
                endGame();
            } else {
                draw();
            }
        }
    }

    function rotatePiece() {
        if (game.isPaused || game.isGameOver || !game.currentPiece?.matrix) return false;
        const originalMatrix = JSON.parse(JSON.stringify(game.currentPiece.matrix));
        const N = originalMatrix.length;
        const rotated = Array(N).fill(null).map(() => Array(N).fill(0));
        for (let y = 0; y < N; y++) {
            if (!originalMatrix[y]) continue;
            for (let x = 0; x < N; x++) {
                if (typeof originalMatrix[y][x] !== 'undefined') rotated[x][N - 1 - y] = originalMatrix[y][x];
            }
        }
        const originalX = game.currentX; const originalY = game.currentY;
        const kickOffsets = [ [0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, -2], [-1,-1], [1,-1], [-1,1], [1,1] ];
        for (const [kickX, kickY] of kickOffsets) {
            const newX = originalX + kickX; const newY = originalY + kickY;
            if (!isCollision(rotated, newX, newY)) {
                game.currentPiece.matrix = rotated;
                game.currentX = newX; game.currentY = newY;
                draw();
                return true;
            }
        }
        return false;
    }

    function hardDrop() {
        if (game.isPaused || game.isGameOver || !game.currentPiece) return;
        let dropCount = 0;
        while (!isCollision(game.currentPiece.matrix, game.currentX, game.currentY + 1)) {
            game.currentY++; dropCount++;
        }
        if (dropCount > 0) { game.score += dropCount * 2; if (elements.score) elements.score.textContent = game.score; }
        moveDown();
    }

    function calculateGhostPosition() {
        if (!game.currentPiece?.matrix || game.isPaused || game.isGameOver) return null;
        const ghostX = game.currentX;
        let ghostY = game.currentY;
        while (!isCollision(game.currentPiece.matrix, ghostX, ghostY + 1)) ghostY++;
        return { x: ghostX, y: ghostY };
    }

    function placePiece() {
        if (!game.currentPiece?.matrix || !game.board || !config?.board) return;
        const {matrix, shape} = game.currentPiece;
        for (let y = 0; y < matrix.length; y++) {
            if (!matrix[y]) continue;
            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x]) {
                    const boardY = game.currentY + y; const boardX = game.currentX + x;
                    if (boardY >= 0 && boardY < config.board.height && boardX >= 0 && boardX < config.board.width && game.board[boardY]) {
                        game.board[boardY][boardX] = shape + 1;
                    }
                }
            }
        }
        game.currentPiece = null;
    }

    function checkLines() {
        if (!game.board || !config?.board) return;
        let linesClearedThisTurn = 0;
        for (let y = config.board.height - 1; y >= 0; y--) {
            if (!game.board[y]) continue;
            if (game.board[y].every(cell => cell > 0)) {
                linesClearedThisTurn++;
                for (let row = y; row > 0; row--) {
                    if (game.board[row - 1]) game.board[row] = game.board[row - 1].slice();
                    else game.board[row] = Array(config.board.width).fill(0);
                }
                game.board[0] = Array(config.board.width).fill(0); y++;
            }
        }
        if (linesClearedThisTurn > 0) updateScore(linesClearedThisTurn);
    }

    function updateScore(linesCleared) {
        const linePoints = [0, 40, 100, 300, 1200];
        const pointsIndex = Math.min(linesCleared, linePoints.length - 1);
        game.score += (linePoints[pointsIndex] || 0) * game.level;
        game.lines += linesCleared;
        const newLevel = Math.floor(game.lines / config.gameplay.linesPerLevel) + 1;
        if (newLevel > game.level) {
            game.level = newLevel;
            if (game.interval) clearInterval(game.interval);
            if (!game.isPaused && !game.isGameOver) {
                game.interval = setInterval(moveDown, getSpeed());
            }
        }
        if (elements.score) elements.score.textContent = game.score;
        if (elements.lines) elements.lines.textContent = game.lines;
        if (elements.level) elements.level.textContent = game.level;
    }

    function togglePause() {
        if (game.isGameOver || !game.gameStarted) return;
        game.isPaused = !game.isPaused;
        if (game.isPaused) {
            clearInterval(game.interval); game.interval = null;
            if (elements.board) elements.board.style.opacity = '0.5';
        } else {
            if (elements.board) elements.board.style.opacity = '1';
            if(game.currentPiece && !game.isGameOver) {
                game.interval = setInterval(moveDown, getSpeed());
            }
            draw();
        }
    }

    function endGame() {
        game.isGameOver = true; game.gameStarted = false;
        if (game.interval) clearInterval(game.interval); game.interval = null;
        addNewHighScore({ name: game.currentPlayerName || "Anonymous", score: game.score });
        displayHighScores();
        if (elements.leaderboardTitle) elements.leaderboardTitle.textContent = "Game Over!";
        if (elements.leaderboardMessage) elements.leaderboardMessage.classList.remove('hidden');
        if (elements.leaderboardActionButtons) elements.leaderboardActionButtons.classList.remove('hidden');
        if (elements.leaderboardTryAgainButton) elements.leaderboardTryAgainButton.style.display = 'inline-block';
        if (elements.leaderboardResetScoresButton) elements.leaderboardResetScoresButton.style.display = 'none';
        if (elements.leaderboardMainMenuButton) elements.leaderboardMainMenuButton.style.display = 'inline-block';
        showScreen(elements.leaderboardScreen);
        if (elements.board) {
            elements.board.removeEventListener('touchstart', handleTouchStart);
            elements.board.removeEventListener('touchmove', handleTouchMove);
            elements.board.removeEventListener('touchend', handleTouchEnd);
        }
        document.removeEventListener('keydown', handleKeyPress);
    }

    // --- Rendering Functions ---
    // Modified createBlock to accept an additional class name for ghost pieces
    function createBlock(parent, left, top, imagePath, fallbackColor, className = 'block') {
        if (!parent) return null;
        const block = document.createElement('div'); 
        block.className = className; // Use provided class or default to 'block'
        if (imagePath) block.style.backgroundImage = `url(${imagePath})`;
        block.style.backgroundColor = fallbackColor || '#333';
        block.style.backgroundSize = 'cover'; block.style.backgroundPosition = 'center';
        block.style.left = left + 'px'; block.style.top = top + 'px';
        block.style.width = game.blockSize + 'px'; block.style.height = game.blockSize + 'px';
        block.style.position = 'absolute'; // Ensure absolute positioning
        parent.appendChild(block); return block;
    }

    function draw() {
        if (game.isPaused || !game.gameStarted) return;
        if (!config?.board || !tetrominoes?.images || !tetrominoes?.colors || !elements?.board || !elements?.nextPiece) { 
            console.error("Draw Fail: Missing critical data or DOM elements."); return; 
        }
        
        // OPTIMIZATION: Clear only dynamic blocks (current piece, ghost piece, placed pieces), not the grid.
        const existingBlocks = elements.board.querySelectorAll('.block, .ghost-block'); // Select both types
        existingBlocks.forEach(block => block.remove());
        
        // Draw the board (existing placed pieces)
        for (let y = 0; y < config.board.height; y++) {
            if (!game.board?.[y]) continue;
            for (let x = 0; x < config.board.width; x++) {
                if (game.board[y][x]) {
                    const blockValue = game.board[y][x] - 1;
                    // Ensure blockValue is a valid index for images and colors
                    if (blockValue >= 0 && blockValue < tetrominoes.images.length && blockValue < tetrominoes.colors.length) {
                        createBlock(elements.board, x * game.blockSize, y * game.blockSize, tetrominoes.images[blockValue], tetrominoes.colors[blockValue], 'block');
                    }
                }
            }
        }
        
        // Draw the ghost piece
        if (game.currentPiece?.matrix) {
            const ghostPos = calculateGhostPosition();
            if (ghostPos) {
                const {matrix, color} = game.currentPiece;
                for (let y = 0; y < matrix.length; y++) {
                    if (!matrix[y]) continue;
                    for (let x = 0; x < matrix[y].length; x++) {
                        if (matrix[y][x]) {
                            // Use the 'ghost-block' class for styling and specific clearing
                            const ghostBlock = createBlock(elements.board, (ghostPos.x + x) * game.blockSize, (ghostPos.y + y) * game.blockSize, null, color, 'ghost-block');
                            if (ghostBlock) {
                                ghostBlock.style.opacity = '0.3'; 
                                ghostBlock.style.border = '1px dashed rgba(255, 255, 255, 0.5)';
                            }
                        }
                    }
                }
            }
        }
        
        // Draw the current piece (on top of ghost piece and placed pieces)
        if (game.currentPiece?.matrix) {
            const {matrix, image, color} = game.currentPiece;
            for (let y = 0; y < matrix.length; y++) {
                if (!matrix[y]) continue;
                for (let x = 0; x < matrix[y].length; x++) {
                    if (matrix[y][x]) {
                        createBlock(elements.board, (game.currentX + x) * game.blockSize, (game.currentY + y) * game.blockSize, image, color, 'block');
                    }
                }
            }
        }
        
        // Draw next piece preview
        if (game.nextPiece) { 
            if(elements.nextPiece) elements.nextPiece.innerHTML = ''; 
            drawNextPiece(); 
        } else { 
            if(elements.nextPiece) elements.nextPiece.innerHTML = ''; 
        }
    }

    function createGrid() {
        if (!elements.board || !config?.board || game.blockSize <= 0) return;
        const existingGridCells = elements.board.querySelectorAll('.grid-cell');
        existingGridCells.forEach(cell => cell.remove()); // Remove only old grid cells

        for (let y = 0; y < config.board.height; y++) {
            for (let x = 0; x < config.board.width; x++) {
                const cell = document.createElement('div'); cell.className = 'grid-cell';
                cell.style.left = x * game.blockSize + 'px'; cell.style.top = y * game.blockSize + 'px';
                cell.style.width = game.blockSize + 'px'; cell.style.height = game.blockSize + 'px';
                cell.style.position = 'absolute';
                elements.board.appendChild(cell);
            }
        }
    }

    function drawNextPiece() {
        if (!elements.nextPiece) return;
        elements.nextPiece.innerHTML = ''; 

        if (!game.nextPiece?.matrix) return;
        const {matrix, image, color} = game.nextPiece;
        if (typeof image === 'undefined' || typeof color === 'undefined') return;

        const containerWidth = elements.nextPiece.clientWidth; 
        const containerHeight = elements.nextPiece.clientHeight;
        if (containerWidth === 0 || containerHeight === 0) return;

        let pieceActualWidth = 0; let pieceActualHeight = 0;
        for (let r = 0; r < matrix.length; r++) {
            if (matrix[r].some(cell => cell !== 0)) pieceActualHeight = r + 1;
            let currentRowWidth = 0;
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c]) currentRowWidth = c + 1;
            }
            if (currentRowWidth > pieceActualWidth) pieceActualWidth = currentRowWidth;
        }
        if (pieceActualWidth === 0 && matrix.length > 0 && matrix[0]) pieceActualWidth = matrix[0].length; 
        if (pieceActualHeight === 0 && matrix.length > 0) pieceActualHeight = matrix.length;
        if (pieceActualWidth === 0 || pieceActualHeight === 0) return;

        const cellSize = Math.max(1, Math.floor(Math.min( containerWidth / pieceActualWidth, containerHeight / pieceActualHeight )));
        const totalPieceRenderWidth = pieceActualWidth * cellSize; 
        const totalPieceRenderHeight = pieceActualHeight * cellSize;
        const offsetX = (containerWidth - totalPieceRenderWidth) / 2; 
        const offsetY = (containerHeight - totalPieceRenderHeight) / 2;

        let firstRow = -1, firstCol = pieceActualWidth;
        for(let r=0; r<matrix.length; ++r){
            if (!matrix[r]) continue;
            for(let c=0; c<matrix[r].length; ++c){
                if(matrix[r][c]){
                    if(firstRow === -1) firstRow = r;
                    if(c < firstCol) firstCol = c;
                }
            }
        }
        if(firstRow === -1) firstRow = 0;

        for (let y = 0; y < matrix.length; y++) { 
            if (!matrix[y]) continue; 
            for (let xVal = 0; xVal < matrix[y].length; xVal++) { 
                if (matrix[y][xVal]) { 
                    const blockDrawX = offsetX + ((xVal - firstCol) * cellSize);
                    const blockDrawY = offsetY + ((y - firstRow) * cellSize);
                    const block = createBlock(elements.nextPiece, blockDrawX, blockDrawY, image, color, 'block' ); 
                    if (block) { 
                        block.style.width = cellSize + 'px'; 
                        block.style.height = cellSize + 'px'; 
                    } 
                } 
            } 
        }
    }

    // --- Event Handlers ---
    function handleResize() {
        const viewportWidth = window.innerWidth; const viewportHeight = window.innerHeight;
        let availableWidth = viewportWidth * 0.95; let availableHeight = viewportHeight * 0.90;
        let blockSizeW = 0, blockSizeH = 0;
        if (config?.board?.width > 0 && config?.board?.height > 0) { 
            blockSizeW = Math.floor(availableWidth / config.board.width); 
            blockSizeH = Math.floor(availableHeight / config.board.height); 
        } else { console.error("Resize Fail: Config invalid!"); game.blockSize = 4; }
        
        game.blockSize = Math.max(4, Math.min(blockSizeW, blockSizeH, 30)); 
        
        let boardPixelWidth = 0, boardPixelHeight = 0;
        if (config?.board) { 
            boardPixelWidth = game.blockSize * config.board.width; 
            boardPixelHeight = game.blockSize * config.board.height; 
        }

        if (boardPixelWidth > 0 && boardPixelHeight > 0 && elements.board && elements.gameAreaWrapper) {
            elements.board.style.width = boardPixelWidth + 'px'; 
            elements.board.style.height = boardPixelHeight + 'px';
            elements.gameAreaWrapper.style.width = boardPixelWidth + 'px'; 
            elements.gameAreaWrapper.style.height = boardPixelHeight + 'px';
        } else { console.error("Resize Fail: Invalid dimensions or elements missing!", boardPixelWidth, boardPixelHeight); }
        
        createGrid(); // Recreate grid with new block size

        if (game.gameStarted && !game.isPaused && !game.isGameOver) { draw(); }
        else if (!game.gameStarted && elements.gameArea?.classList.contains('hidden')) {
            if (elements.board && elements.board.style.display !== 'none') {
                 const existingBlocks = elements.board.querySelectorAll('.block, .ghost-block');
                 existingBlocks.forEach(block => block.remove());
            }
        }
        if (elements.nextPiece) { 
            if (game.nextPiece) drawNextPiece(); 
            else elements.nextPiece.innerHTML = ''; 
        }
    }

    function handleKeyPress(event) {
        if (game.isGameOver || !game.gameStarted) return;
        const key = event.key?.toLowerCase(); // Get key and convert to lower case
        if (game.isPaused && key !== 'p') return;

        switch (key) {
            case 'arrowleft': case 'a': movePiece(-1); event.preventDefault(); break;
            case 'arrowright': case 'd': movePiece(1); event.preventDefault(); break;
            case 'arrowup': case 'w': rotatePiece(); event.preventDefault(); break;
            case 'arrowdown': case 's': moveDown(); event.preventDefault(); break;
            case ' ': hardDrop(); event.preventDefault(); break; // Spacebar
            case 'p': togglePause(); event.preventDefault(); break;
        }
    }

    function handleTouchStart(e) {
        if (game.isGameOver || game.isPaused || !game.gameStarted || e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        touch.startX = t.clientX;         // Initial X for tap/swipe differentiation
        touch.startY = t.clientY;         // Initial Y for tap/swipe differentiation
        touch.currentX = t.clientX;       // Starting point for current drag segment
        touch.startTime = Date.now();
        touch.isDragging = false;
        touch.isSwipedDown = false;
        touch.movedHorizontally = false;
    }

    function handleTouchMove(e) {
        if (game.isGameOver || game.isPaused || !game.gameStarted || !touch.startTime || e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        const deltaXFromLastProcessedMove = t.clientX - touch.currentX; // Finger movement since last piece move
        const deltaYTotalAbsolute = t.clientY - touch.startY; // Total Y movement from start of touch
        const deltaXTotalAbsolute = t.clientX - touch.startX; // Total X movement from start of touch

        if (!config?.touch) return;
        const moveThresholdPixels = game.blockSize * config.touch.moveThresholdRatio;

        // Swift Horizontal Drag Logic
        if (Math.abs(deltaXFromLastProcessedMove) >= moveThresholdPixels) {
            const direction = deltaXFromLastProcessedMove > 0 ? 1 : -1;
            if (movePiece(direction)) { // movePiece calls draw()
                // Update currentX to the finger's current position that triggered this move.
                // This makes the next check relative to this new finger position.
                touch.currentX = t.clientX; 
                
                // If a horizontal move happened, update flags and reset startX/startY
                // for tap/swipe differentiation. This ensures a drag isn't mistaken for a tap.
                touch.movedHorizontally = true;
                touch.isDragging = true; 
                touch.startX = t.clientX; // Reset tap/swipe origin to current finger position
                touch.startY = t.clientY;
            }
        }

        // Swipe Down for Hard Drop Logic (prioritize strong vertical movement)
        if (!touch.isSwipedDown && // Only allow one hard drop per swipe
            deltaYTotalAbsolute > config.touch.swipeDownThreshold && // Must swipe down enough
            Math.abs(deltaYTotalAbsolute) > Math.abs(deltaXTotalAbsolute) * 1.5) { // Vertical movement must be dominant
            
            touch.isSwipedDown = true;
            hardDrop();
            touch.startTime = 0; // End this touch interaction sequence
        }
    }

    function handleTouchEnd(e) {
        if (game.isGameOver || game.isPaused || !game.gameStarted || !touch.startTime || e.changedTouches.length !== 1) return;
        
        const touchDuration = Date.now() - touch.startTime;
        // Calculate total distance moved from the VERY start of the touch
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const totalMoveDistance = Math.sqrt(Math.pow(endX - touch.startX, 2) + Math.pow(endY - touch.startY, 2));
        
        if (!config?.touch) return;

        // Tap to Rotate:
        // - No hard drop swipe occurred
        // - No significant horizontal dragging that resulted in piece movement
        // - Touch duration is short
        // - Total finger movement from initial touch point is small
        if (!touch.isSwipedDown && !touch.movedHorizontally &&
            touchDuration < config.touch.tapTimeout &&
            totalMoveDistance < config.touch.dragThreshold * 1.5) { // Allow slightly more for tap than pure drag
            rotatePiece();
        }

        // Reset touch state for the next interaction
        touch.startTime = 0;
        touch.isDragging = false;
        touch.isSwipedDown = false;
        touch.movedHorizontally = false;
    }

    // --- Initialization and Event Listener Setup ---
    function setupGameplayEventListeners() {
        if (!elements.board) return;
        elements.board.removeEventListener('touchstart', handleTouchStart); 
        elements.board.removeEventListener('touchmove', handleTouchMove); 
        elements.board.removeEventListener('touchend', handleTouchEnd); 
        document.removeEventListener('keydown', handleKeyPress);
        
        elements.board.addEventListener('touchstart', handleTouchStart, { passive: false }); 
        elements.board.addEventListener('touchmove', handleTouchMove, { passive: false }); 
        elements.board.addEventListener('touchend', handleTouchEnd, { passive: false }); 
        document.addEventListener('keydown', handleKeyPress);
    }

    function setupUIEventListeners() {
        elements.startGameButton?.addEventListener('click', () => {
            const playerName = elements.playerNameInput?.value.trim();
            if (playerName) {
                game.currentPlayerName = playerName;
                if(elements.nameError) elements.nameError.textContent = '';
                showScreen(elements.gameArea);
                startGame();
            } else {
                if(elements.nameError) elements.nameError.textContent = 'Please enter your name!';
            }
        });
        elements.viewLeaderboardButton?.addEventListener('click', () => {
            if(elements.leaderboardTitle) elements.leaderboardTitle.textContent = "High Scores";
            if(elements.leaderboardMessage) elements.leaderboardMessage.classList.add('hidden');
            if(elements.leaderboardActionButtons) elements.leaderboardActionButtons.classList.remove('hidden');
            if(elements.leaderboardTryAgainButton) elements.leaderboardTryAgainButton.style.display = 'none';
            if(elements.leaderboardResetScoresButton) elements.leaderboardResetScoresButton.style.display = 'inline-block';
            if(elements.leaderboardMainMenuButton) elements.leaderboardMainMenuButton.style.display = 'inline-block';
            displayHighScores();
            showScreen(elements.leaderboardScreen);
        });
        elements.leaderboardTryAgainButton?.addEventListener('click', () => {
            if (game.currentPlayerName) { 
                showScreen(elements.gameArea);
                startGame();
            } else { 
                showScreen(elements.startScreen);
            }
        });
        elements.leaderboardMainMenuButton?.addEventListener('click', () => {
            showScreen(elements.startScreen);
        });
        elements.leaderboardResetScoresButton?.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset all high scores? This cannot be undone.")) {
                saveHighScores([]);
                displayHighScores(); 
            }
        });
        window.addEventListener('resize', handleResize);
    }

    function startGame() {
        game.score = 0; game.lines = 0; game.level = 1;
        game.isGameOver = false; game.isPaused = false;
        game.currentPiece = null; game.nextPiece = null;
        game.gameStarted = true; game.pieceBag = []; 

        if (game.interval) { clearInterval(game.interval); game.interval = null; }
        
        initBoard(); 

        if (elements.score) elements.score.textContent = game.score;
        if (elements.lines) elements.lines.textContent = game.lines;
        if (elements.level) elements.level.textContent = game.level;
        
        if(elements.leaderboardMessage) elements.leaderboardMessage.classList.add('hidden');
        if(elements.leaderboardTryAgainButton) elements.leaderboardTryAgainButton.style.display = 'none';
        if(elements.leaderboardResetScoresButton) elements.leaderboardResetScoresButton.style.display = 'none';
        if(elements.leaderboardTitle) elements.leaderboardTitle.textContent = "High Scores";

        fillAndShuffleBag(); 
        game.currentPiece = createPiece();
        game.nextPiece = createPiece();

        if (!game.currentPiece || !game.nextPiece) {
            console.error("startGame ERROR: Failed to create initial pieces."); endGame(); return;
        }
        if (!game.currentPiece.matrix) {
            console.error("startGame ERROR: game.currentPiece is missing a valid 'matrix'."); endGame(); return;
        }
        
        handleResize(); // Sets up sizes and calls createGrid()
        
        resetPiecePosition(); 
        if (isCollision(game.currentPiece.matrix, game.currentX, game.currentY)) {
            endGame(); return;
        }
        
        game.interval = setInterval(moveDown, getSpeed());
        setupGameplayEventListeners();
        draw();
    }

    function init() {
        // CSS should handle #board { position: relative; } and #next-piece { position: relative; }
        setupUIEventListeners(); 
        handleResize(); 
        showScreen(elements.startScreen); 
    }
    init();
});
