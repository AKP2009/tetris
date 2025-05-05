document.addEventListener('DOMContentLoaded', () => {
    // Log the definitions ONLY if you still suspect issues with them
    // console.log("Tetrominoes definition:", JSON.stringify(tetrominoes, null, 2));
    // console.log("Config definition:", JSON.stringify(config, null, 2));

    // Game configuration - ENSURE THIS IS CORRECT AND UNCOMMENTED IN YOUR FILE
    const config = {
        board: {
            width: 10,
            height: 20
        },
        touch: {
            dragThreshold: 15,
            moveThresholdRatio: 0.5, // Ratio of block size for horizontal move detection
            swipeDownThreshold: 50, // Pixels to swipe down for hard drop
            tapTimeout: 200         // Milliseconds to qualify as a tap
        }
    };

    // Tetromino definitions - ENSURE THIS IS CORRECT AND UNCOMMENTED IN YOUR FILE
    const tetrominoes = {
        shapes: [
            // I (Uses image1.png)
            [
                [0, 0, 0, 0],
                [1, 1, 1, 1],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ],
            // J (Uses image2.png)
            [
                [1, 0, 0],
                [1, 1, 1],
                [0, 0, 0]
            ],
            // L (Uses image3.png)
            [
                [0, 0, 1],
                [1, 1, 1],
                [0, 0, 0]
            ],
            // O (Uses image4.png)
            [
                [1, 1],
                [1, 1]
            ],
            // S (Uses image5.png)
            [
                [0, 1, 1],
                [1, 1, 0],
                [0, 0, 0]
            ],
            // T (Uses image6.png)
            [
                [0, 1, 0],
                [1, 1, 1],
                [0, 0, 0]
            ],
            // Z (Uses image7.png)
            [
                [1, 1, 0],
                [0, 1, 1],
                [0, 0, 0]
            ]
        ],
        colors: [ // Fallback colors if images fail to load
            "#00f0f0", "#0000f0", "#f0a000", "#f0f000", "#00f000", "#a000f0", "#f00000"
        ],
        images: [ // Image paths - MAKE SURE THESE FILES EXIST
            'image1.png', 'image2.png', 'image3.png', 'image4.png',
            'image5.png', 'image6.png', 'image7.png'
        ]
    };

    // Game state
    const game = {
        board: [], // 2D array representing the game board state
        score: 0,
        lines: 0,
        level: 1,
        currentPiece: null, // The currently falling piece object
        nextPiece: null,    // The upcoming piece object
        currentX: 0,        // X position (column) of the current piece's top-left corner
        currentY: 0,        // Y position (row) of the current piece's top-left corner
        blockSize: 20,      // Pixel size of each block (will be recalculated)
        interval: null,     // ID for the game loop timer (setInterval)
        isPaused: false,
        isGameOver: false,
        gameStarted: false  // Flag to track if the game is actively running
    };

    // DOM element references
    const elements = {
        body: document.body,
        gameAreaWrapper: document.getElementById('game-area-wrapper'),
        board: document.getElementById('board'),
        nextPieceContainer: document.getElementById('next-piece-container'),
        nextPiece: document.getElementById('next-piece'), // The div *inside* the container
        statsPanel: document.getElementById('stats-panel'),
        score: document.getElementById('score'),
        lines: document.getElementById('lines'),
        level: document.getElementById('level'),
        startButton: document.getElementById('start-button'),
        gameOver: document.getElementById('game-over'),
        finalScore: document.getElementById('final-score'),
        restartButton: document.getElementById('restart-button')
    };

    // Touch tracking state
    const touch = {
        startX: 0,
        startY: 0,
        currentX: 0, // Tracks horizontal position during move for incremental detection
        startTime: 0,
        isDragging: false,   // Primarily for detecting if a move wasn't just a tap
        isSwipedDown: false, // Flag to ensure hard drop only happens once per swipe
        movedHorizontally: false // Flag to distinguish drag from tap
    };

    // --- Core Game Logic Functions ---

    // Creates a new random tetromino piece object
    // createPiece function with added checks
    function createPiece() {
        console.log("Attempting to create piece..."); // Add log

        // --- Add Checks ---
        // Ensure tetrominoes object and its essential properties exist and are valid
        if (!tetrominoes || !tetrominoes.shapes || !Array.isArray(tetrominoes.shapes) || tetrominoes.shapes.length === 0) {
            console.error("Cannot create piece: tetrominoes.shapes is missing, not an array, or empty.");
            return null; // Indicate failure: cannot proceed without shapes
        }
        if (!tetrominoes.images || !Array.isArray(tetrominoes.images) || !tetrominoes.colors || !Array.isArray(tetrominoes.colors)) {
             console.error("Cannot create piece: tetrominoes.images or tetrominoes.colors is missing or not an array.");
             return null; // Indicate failure: missing image or color data
        }
        // Check if all arrays have the same non-zero length
        if (tetrominoes.shapes.length === 0 || tetrominoes.images.length !== tetrominoes.shapes.length || tetrominoes.colors.length !== tetrominoes.shapes.length) {
            console.error("Cannot create piece: Mismatch in lengths or zero length for shapes, images, or colors arrays.");
            return null; // Indicate failure: data arrays don't align or are empty
        }
        // --- End Checks ---

        // Generate random index based on the number of shapes
        const index = Math.floor(Math.random() * tetrominoes.shapes.length);

         // Basic check on index validity (should be okay if lengths match, but good safety)
         if(index < 0 || index >= tetrominoes.shapes.length) {
              console.error(`Cannot create piece: Invalid random index ${index}`);
              return null; // Indicate failure: index out of bounds
         }

        console.log("Creating piece with index:", index); // Add log

        // Ensure the specific shape data (matrix) exists at the generated index
        if (!tetrominoes.shapes[index] || !Array.isArray(tetrominoes.shapes[index])) {
             console.error(`Cannot create piece: No valid shape data (matrix) found at index ${index}`);
             return null; // Indicate failure: specific shape data is missing or invalid
        }
        // Ensure image and color data exist at the index
        if (typeof tetrominoes.images[index] === 'undefined' || typeof tetrominoes.colors[index] === 'undefined') {
             console.error(`Cannot create piece: Image or Color data missing at index ${index}`);
             return null; // Indicate failure: specific image/color data is missing
        }

        // If all checks pass, return the piece object
        return {
            shape: index, // The index (useful for identifying the type)
            matrix: tetrominoes.shapes[index], // The actual shape matrix
            image: tetrominoes.images[index], // The image path
            color: tetrominoes.colors[index]  // The fallback color
        };
    }

    // Initializes the internal game board array
    function initBoard() {
        // Ensure config.board is valid before using it
        if (!config || !config.board || !Number.isInteger(config.board.height) || !Number.isInteger(config.board.width)) {
             console.error("initBoard failed: config.board dimensions are invalid.");
             game.board = []; // Set to empty array to prevent errors
             return;
        }
        game.board = Array(config.board.height).fill().map(() => Array(config.board.width).fill(0));
        // Clear visual board (will be redrawn)
        if (elements.board) elements.board.innerHTML = '';
    }

    // Calculates game speed based on level
    function getSpeed() {
        // Speed increases up to level 10
        return Math.max(100, 1000 - (Math.min(game.level, 10) - 1) * 90); // Max speed = 100ms/step
    }

    // Resets the current piece's position to the top center
    function resetPiecePosition() {
        if (!game.currentPiece || !game.currentPiece.matrix || !config || !config.board) {
             console.error("Cannot reset piece position: Missing current piece, matrix, or config.");
             return;
        }

        // Calculate starting X position (centered horizontally)
        const pieceWidth = game.currentPiece.matrix[0]?.length || 0; // Get width from first row safely
        game.currentX = Math.floor(config.board.width / 2) - Math.floor(pieceWidth / 2);

        // Calculate starting Y position (usually 0, but adjust for pieces with empty top rows)
        game.currentY = 0;
        for (let y = 0; y < game.currentPiece.matrix.length; y++) {
            // Check if the row itself exists and if it contains any blocks
            if (game.currentPiece.matrix[y] && game.currentPiece.matrix[y].some(cell => cell !== 0)) {
                break; // Found the first row with blocks, stop adjusting Y
            }
            // If the row is empty, effectively start the piece one row higher
            game.currentY--;
        }
    }

    // Checks for collision at a given position
    function isCollision(matrix, x, y) {
        if (!matrix || !config || !config.board || !game.board) {
            console.warn("Collision check skipped: Missing matrix, config, or game board.");
            return true; // Treat missing data as a collision for safety
        }

        for (let row = 0; row < matrix.length; row++) {
            // Ensure the matrix row exists
             if (!matrix[row]) continue;

            for (let col = 0; col < matrix[row].length; col++) {
                // Check only filled cells of the piece's matrix
                if (matrix[row][col]) {
                    const boardX = x + col; // Calculate position on the main board
                    const boardY = y + row;

                    // Check for collisions with board boundaries
                    if (boardX < 0 || boardX >= config.board.width || boardY >= config.board.height) {
                        return true; // Collision with wall or floor
                    }

                    // Check for collisions with existing blocks on the board
                    // Only check if boardY is within bounds (>= 0)
                    // Ensure the game.board row exists before accessing it
                    if (boardY >= 0 && game.board[boardY] && game.board[boardY][boardX]) {
                        return true; // Collision with another block
                    }
                }
            }
        }
        // If no collisions were detected after checking all cells
        return false;
    }

    // --- Movement Functions ---

    // Moves the current piece left or right
    function movePiece(direction) {
        if (game.isPaused || game.isGameOver || !game.currentPiece) return false; // Can't move if paused, over, or no piece

        const newX = game.currentX + direction; // Calculate new X position

        // Check for collision at the new position
        if (!isCollision(game.currentPiece.matrix, newX, game.currentY)) {
            game.currentX = newX; // Update position if no collision
            draw(); // Redraw the board
            return true; // Move successful
        }
        return false; // Move failed due to collision
    }

    // Moves the current piece down by one step (game tick or soft drop)
    function moveDown() {
        // console.log("moveDown called - Paused:", game.isPaused, "GameOver:", game.isGameOver, "Piece:", !!game.currentPiece); // Uncomment for debugging
        if (game.isPaused || game.isGameOver || !game.currentPiece) return;

        // Check for collision one step below the current position
        if (!isCollision(game.currentPiece.matrix, game.currentX, game.currentY + 1)) {
            game.currentY++; // Move down if no collision
            draw(); // Redraw the board
        } else {
            // Collision detected below: Piece has landed
            placePiece(); // Merge the piece into the board
            checkLines(); // Check for and clear completed lines

            // Spawn the next piece
            game.currentPiece = game.nextPiece;
            game.nextPiece = createPiece(); // Generate the new upcoming piece

            // Critical Check: Ensure new pieces were created successfully
             if (!game.currentPiece || !game.nextPiece) {
                 console.error("moveDown ERROR: Failed to create new/next piece. Ending game.");
                 endGame(); // End game if pieces can't be created
                 return;
             }
              if (!game.currentPiece.matrix) {
                  console.error("moveDown ERROR: New current piece has no matrix. Ending game.");
                  endGame(); // End game if new piece is invalid
                  return;
             }


            resetPiecePosition(); // Position the new piece at the top

            // Check for game over condition (collision immediately after spawning)
            if (isCollision(game.currentPiece.matrix, game.currentX, game.currentY)) {
                console.log("Game Over - Collision on new piece spawn.");
                endGame();
            } else {
                draw(); // Redraw with the new piece
            }
        }
    }

    // Rotates the current piece clockwise
    function rotatePiece() {
        if (game.isPaused || game.isGameOver || !game.currentPiece || !game.currentPiece.matrix) return false;

        const matrix = game.currentPiece.matrix;
        const N = matrix.length; // Assuming square matrices for rotation simplicity
        const rotated = Array(N).fill().map(() => Array(N).fill(0));

        // Perform rotation
        for (let y = 0; y < N; y++) {
             // Ensure the source row exists
             if (!matrix[y]) continue;
            for (let x = 0; x < N; x++) {
                // Check if source cell exists before reading
                if (typeof matrix[y][x] !== 'undefined') {
                    rotated[x][N - 1 - y] = matrix[y][x];
                }
            }
        }

        // --- Wall Kick Logic (Basic Implementation) ---
        // Try different offsets (kicks) if the initial rotation collides
        const originalX = game.currentX;
        const originalY = game.currentY;
        const kickOffsets = [ [0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, -2] ]; // Basic kicks, more complex needed for SRS

        for (const [kickX, kickY] of kickOffsets) {
            const newX = originalX + kickX;
            const newY = originalY + kickY;
            if (!isCollision(rotated, newX, newY)) {
                // Found a valid position after kick
                game.currentPiece.matrix = rotated;
                game.currentX = newX;
                game.currentY = newY;
                draw(); // Redraw with rotated piece
                return true; // Rotation successful
            }
        }
        // If no valid position found after trying all kicks
        return false; // Rotation failed
    }

    // Instantly drops the piece to the lowest possible position
    function hardDrop() {
        if (game.isPaused || game.isGameOver || !game.currentPiece) return;

        let dropCount = 0;
        // Keep moving down as long as there's no collision one step below
        while (!isCollision(game.currentPiece.matrix, game.currentX, game.currentY + 1)) {
            game.currentY++;
            dropCount++;
        }

        // Optional: Add score for hard drop distance
        if (dropCount > 0) {
            game.score += dropCount * 2; // Example: 2 points per row dropped
             if (elements.score) elements.score.textContent = game.score;
        }

        // Once it can't move down further, trigger the landing sequence
        moveDown(); // moveDown handles placing, checking lines, and next piece
    }


    // --- Game State Update Functions ---

    // Merges the current piece into the board state
    function placePiece() {
        if (!game.currentPiece || !game.currentPiece.matrix || !game.board || !config || !config.board) return;

        const matrix = game.currentPiece.matrix;
        for (let y = 0; y < matrix.length; y++) {
             if (!matrix[y]) continue; // Ensure row exists

            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x]) { // If this part of the piece is filled
                    const boardY = game.currentY + y;
                    const boardX = game.currentX + x;

                    // Place piece onto board if within bounds
                    // Check both vertical and horizontal bounds
                    if (boardY >= 0 && boardY < config.board.height &&
                        boardX >= 0 && boardX < config.board.width &&
                        game.board[boardY]) { // Ensure target row exists
                        // Store shape index + 1 (to distinguish from empty 0)
                        game.board[boardY][boardX] = game.currentPiece.shape + 1;
                    }
                }
            }
        }
        // Piece is now part of the board, clear the current piece
        game.currentPiece = null;
    }

    // Checks for and clears completed lines
    function checkLines() {
         if (!game.board || !config || !config.board) return;

        let linesCleared = 0;
        // Iterate from bottom row upwards
        for (let y = config.board.height - 1; y >= 0; y--) {
            // Ensure row exists before checking `every`
             if (!game.board[y]) continue;

            // Check if every cell in the current row is filled (non-zero)
            if (game.board[y].every(cell => cell > 0)) {
                linesCleared++;
                // Remove the completed line by shifting all rows above it down
                for (let row = y; row > 0; row--) {
                     // Check if source row exists before copying
                     if (game.board[row - 1]) {
                         game.board[row] = game.board[row - 1].slice(); // Copy row above
                     } else {
                          // If row above doesn't exist (shouldn't happen), fill with 0s
                          game.board[row] = Array(config.board.width).fill(0);
                     }
                }
                // Add a new empty row at the top
                game.board[0] = Array(config.board.width).fill(0);
                // Since we cleared a line and shifted rows down,
                // we need to re-check the current row index 'y' again
                y++;
            }
        }

        // Update score and potentially level if lines were cleared
        if (linesCleared > 0) {
            updateScore(linesCleared);
        }
    }

    // Updates score, lines cleared, and level
    function updateScore(linesCleared) {
        // Scoring system (example: Tetris Guideline scoring)
        const linePoints = [0, 40, 100, 300, 1200]; // Points for 0, 1, 2, 3, 4 lines
        // Award points based on lines cleared and current level
        game.score += (linePoints[linesCleared] || 0) * game.level;
        game.lines += linesCleared;

        // Update level based on lines cleared (e.g., new level every 10 lines)
        const newLevel = Math.floor(game.lines / 10) + 1;
        if (newLevel > game.level) {
            game.level = newLevel;
            console.log("Level Up!", game.level);
            // Increase game speed by clearing and resetting the interval
            if (game.interval) clearInterval(game.interval);
            game.interval = setInterval(moveDown, getSpeed());
        }

        // Update UI elements
         if (elements.score) elements.score.textContent = game.score;
         if (elements.lines) elements.lines.textContent = game.lines;
         if (elements.level) elements.level.textContent = game.level;
    }

    // Toggles the pause state of the game
    function togglePause() {
        if (game.isGameOver || !game.gameStarted) return; // Can't pause if not started or over

        game.isPaused = !game.isPaused; // Flip the pause state

        if (game.isPaused) {
            clearInterval(game.interval); // Stop the game loop
             game.interval = null; // Clear interval ID
            if (elements.board) elements.board.style.opacity = '0.5'; // Dim the board visually
            console.log("Game Paused");
            // TODO: Optionally display a "Paused" message on screen
        } else {
            if (elements.board) elements.board.style.opacity = '1'; // Restore board visibility
            // Resume game loop only if there's a current piece
            if(game.currentPiece) {
                 game.interval = setInterval(moveDown, getSpeed());
            }
            console.log("Game Resumed");
            draw(); // Redraw immediately when resuming
        }
    }

    // Ends the current game
    function endGame() {
        console.log("Game Over! Final Score:", game.score);
        game.isGameOver = true;
        game.gameStarted = false; // Mark game as not running

        // Stop the game loop
        if (game.interval) clearInterval(game.interval);
        game.interval = null;

        // Display game over screen and final score
        if (elements.finalScore) elements.finalScore.textContent = game.score;
        if (elements.gameOver) elements.gameOver.style.display = 'block';

        // Remove gameplay-specific event listeners
        if (elements.board) {
             elements.board.removeEventListener('touchstart', handleTouchStart);
             elements.board.removeEventListener('touchmove', handleTouchMove);
             elements.board.removeEventListener('touchend', handleTouchEnd);
        }
        document.removeEventListener('keydown', handleKeyPress);

        // Ensure restart button is visible (it's inside the game over div)
        // if(elements.restartButton) elements.restartButton.style.display = 'inline-block'; // CSS should handle this
    }

    // Starts a new game or restarts the game
    // startGame function with added checks after createPiece calls
    function startGame() {
        console.log("startGame function STARTING..."); // Log start

        // Hide the initial start button once game begins
        if (elements.startButton) { // Check if button exists
             elements.startButton.style.display = 'none';
        }

        // Reset game state variables
        game.score = 0;
        game.lines = 0;
        game.level = 1;
        game.isGameOver = false;
        game.isPaused = false;
        game.currentPiece = null; // Reset pieces
        game.nextPiece = null;
        game.gameStarted = true; // Mark game as started

        // Clear previous game loop interval if it exists
        if (game.interval) {
            clearInterval(game.interval);
            game.interval = null;
        }

        // Initialize the board array and clear visual board
        initBoard();

        // Update UI display for score, lines, level
        if (elements.score) elements.score.textContent = game.score;
        if (elements.lines) elements.lines.textContent = game.lines;
        if (elements.level) elements.level.textContent = game.level;

        // Hide game over screen and ensure board is fully visible
        if (elements.gameOver) elements.gameOver.style.display = 'none';
        if (elements.board) elements.board.style.opacity = '1';

        // --- Create initial pieces ---
        game.currentPiece = createPiece();
        game.nextPiece = createPiece();

        // --- Add Check: Ensure pieces were created successfully ---
        if (!game.currentPiece || !game.nextPiece) {
            console.error("startGame ERROR: Failed to create initial pieces. Check createPiece logs. Aborting start.");
            // Optionally display an error message to the user here
            endGame(); // Call endGame to show Game Over screen if pieces fail
            // game.gameStarted = false; // endGame already sets this
            return; // Stop startGame execution
        }
        // Check if the crucial 'matrix' property exists on the current piece
        if (!game.currentPiece.matrix || !Array.isArray(game.currentPiece.matrix)) {
             console.error("startGame ERROR: game.currentPiece is missing a valid 'matrix' property! Aborting start.");
             // Optionally display an error message
             endGame(); // End game if piece is invalid
             // game.gameStarted = false; // endGame sets this
             return; // Stop startGame execution
        }
        // --- End Check ---

        // Calculate sizes and reset piece position *after* creating pieces
        handleResize(); // Calculate initial sizes based on current viewport
        resetPiecePosition(); // Set piece position *after* sizing and piece creation

        // Check for immediate collision after placing the first piece
        if (isCollision(game.currentPiece.matrix, game.currentX, game.currentY)) {
            console.warn("Immediate collision on start. Ending game.");
            endGame(); // End the game if it starts in a collision state
            return; // Stop startGame
        }

        // Start the main game loop
        game.interval = setInterval(moveDown, getSpeed());

        // Setup event listeners for gameplay controls
        setupGameplayEventListeners();

        // Perform the initial draw of the board and pieces
        draw();

        // Focus the board for keyboard events (optional, depends on setup)
        // if (elements.board) elements.board.focus();

        console.log("startGame function FINISHED."); // Log finish
    }


    // --- Rendering Functions ---

    // Renders the entire game state (board, pieces) onto the HTML elements
    // draw function (Includes checks for robustness)
    function draw() {
        // console.log("draw called - Started:", game.gameStarted, "Paused:", game.isPaused);
        if (game.isPaused || !game.gameStarted) return; // Don't draw if paused or not started

        // --- Basic Checks ---
        if (!config || !config.board) {
            console.error("Cannot draw: config or config.board is undefined.");
            return;
        }
         if (!tetrominoes || !tetrominoes.images || !tetrominoes.colors) {
            console.error("Cannot draw: tetrominoes object or its properties (images, colors) are undefined.");
            return; // Exit if tetrominoes data is missing
        }
         if (!elements || !elements.board || !elements.nextPiece) {
             console.error("Cannot draw: Essential DOM elements are missing.");
             return;
         }

        // --- Clear Board & Draw Grid ---
        elements.board.innerHTML = ''; // Clear previous blocks/grid
        createGrid(); // Draw grid lines

        // --- Draw Landed Blocks ---
        // console.log("Drawing landed blocks...");
        for (let y = 0; y < config.board.height; y++) {
            // Ensure the row exists in the game board array
            if (!game.board || !game.board[y]) continue;

            for (let x = 0; x < config.board.width; x++) {
                if (game.board[y][x]) { // Check if there is a block value (non-zero)
                    const blockValue = game.board[y][x] - 1; // Calculate index (0-based)

                    // Check if blockValue is a valid index for images/colors arrays
                    if (blockValue >= 0 && blockValue < tetrominoes.images.length && blockValue < tetrominoes.colors.length) {
                        createBlock(
                            elements.board, // Parent is the board
                            x * game.blockSize,
                            y * game.blockSize,
                            tetrominoes.images[blockValue],
                            tetrominoes.colors[blockValue]
                        );
                    } else {
                         console.warn(`Invalid blockValue ${blockValue} at board[${y}][${x}]`);
                         // Optionally draw a default error block here using a default color/image
                    }
                }
            }
        }

        // --- Draw Current Piece ---
        if (game.currentPiece && game.currentPiece.matrix) {
            // console.log("Drawing current piece:", game.currentPiece.shape);
            const matrix = game.currentPiece.matrix;
            const image = game.currentPiece.image;
            const color = game.currentPiece.color;

             // Check if image and color are defined for the current piece
             if (typeof image === 'undefined' || typeof color === 'undefined') {
                 console.warn("Current piece is missing image or color property.");
                 // Potentially use a default image/color here if needed
             }

            for (let y = 0; y < matrix.length; y++) {
                // Ensure the matrix row exists
                if (!matrix[y]) continue;

                for (let x = 0; x < matrix[y].length; x++) {
                    if (matrix[y][x]) { // If this cell is part of the tetromino
                         // Check image/color again just in case they were undefined
                         if (typeof image !== 'undefined' && typeof color !== 'undefined') {
                              createBlock(
                                  elements.board,
                                  (game.currentX + x) * game.blockSize,
                                  (game.currentY + y) * game.blockSize,
                                  image,
                                  color
                              );
                         } else {
                              // Fallback if image/color were missing (shouldn't happen often with checks in createPiece)
                              console.warn(`Rendering current piece block at [${y}][${x}] without valid image/color.`);
                         }
                    }
                }
            }
        } else {
            // console.log("Draw called, but no current piece or current piece matrix.");
        }

        // --- Draw Next Piece Preview ---
        if (game.nextPiece) {
            // console.log("Clearing and drawing next piece...");
            elements.nextPiece.innerHTML = ''; // Clear previous preview first
            drawNextPiece(); // This function should also have checks
        } else {
             // console.log("Draw called, but no next piece.");
             elements.nextPiece.innerHTML = ''; // Ensure preview is empty if no next piece
        }
         // console.log("draw finished.");
    }

    // Helper function to create a single block element
    function createBlock(parent, left, top, imagePath, fallbackColor) {
        if (!parent) return null; // Don't create if parent is invalid

        const block = document.createElement('div');
        block.className = 'block';

        // Set background image and fallback color
        if (imagePath) {
            block.style.backgroundImage = `url(${imagePath})`;
        }
        block.style.backgroundColor = fallbackColor || '#333'; // Default fallback color

        // Ensure background covers the block area
        block.style.backgroundSize = 'cover';
        block.style.backgroundPosition = 'center';

        // Set position and size (use game.blockSize)
        block.style.left = left + 'px';
        block.style.top = top + 'px';
        block.style.width = game.blockSize + 'px';
        block.style.height = game.blockSize + 'px';

        parent.appendChild(block);
        return block;
    }

    // Creates the visual grid lines on the board
    function createGrid() {
         if (!elements.board || !config || !config.board || game.blockSize <= 0) return; // Need element, config, and valid size

        for (let y = 0; y < config.board.height; y++) {
            for (let x = 0; x < config.board.width; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.style.left = x * game.blockSize + 'px';
                cell.style.top = y * game.blockSize + 'px';
                cell.style.width = game.blockSize + 'px';
                cell.style.height = game.blockSize + 'px';
                elements.board.appendChild(cell);
            }
        }
    }

    // Draws the next piece in its preview area
    function drawNextPiece() {
        // Ensure necessary elements and data exist
        if (!game.nextPiece || !game.nextPiece.matrix || !elements.nextPiece) {
            console.warn("Cannot draw next piece: Missing data or element.");
            if(elements.nextPiece) elements.nextPiece.innerHTML = ''; // Clear if element exists but data doesn't
            return;
        }

        const matrix = game.nextPiece.matrix;
        const image = game.nextPiece.image;
        const color = game.nextPiece.color;

        // Check image/color existence for next piece
         if (typeof image === 'undefined' || typeof color === 'undefined') {
             console.warn("Next piece is missing image or color property.");
             // Decide on fallback behavior - maybe don't draw it?
             // return;
         }


        const containerWidth = elements.nextPiece.clientWidth;
        const containerHeight = elements.nextPiece.clientHeight;

        // Calculate the actual dimensions required by the piece matrix
        let matrixWidth = 0;
        let matrixHeight = 0;
        for (let y = 0; y < matrix.length; y++) {
             let rowHasBlock = false;
             let currentWidth = 0;
             if (!matrix[y]) continue; // Skip if row doesn't exist
             for(let x=0; x<matrix[y].length; x++) {
                 if (matrix[y][x]) {
                     rowHasBlock = true;
                     currentWidth = x + 1; // Width is index + 1
                 }
             }
             if(rowHasBlock) matrixHeight = y + 1; // Height is index + 1
             if (currentWidth > matrixWidth) matrixWidth = currentWidth;
        }

        // Handle cases like 'O' piece or if calculation failed
        if (matrixWidth === 0 && matrix.length > 0 && matrix[0]) matrixWidth = matrix[0].length;
        if (matrixHeight === 0 && matrix.length > 0) matrixHeight = matrix.length;
        if (matrixWidth === 0 || matrixHeight === 0) {
            console.warn("Cannot draw next piece: Calculated matrix dimensions are zero.");
            return; // Cannot calculate size if dimensions are 0
        }

        // Calculate cell size to fit the piece within the container
        const padding = 0; // Minimal padding inside the preview box
        const cellSize = Math.max(1, Math.floor(Math.min( // Ensure cell size is at least 1px
            containerWidth / (matrixWidth + padding),
            containerHeight / (matrixHeight + padding)
        )));

        // Calculate offsets to center the piece within the container
        const totalWidth = matrixWidth * cellSize;
        const totalHeight = matrixHeight * cellSize;
        const offsetX = (containerWidth - totalWidth) / 2;
        const offsetY = (containerHeight - totalHeight) / 2;

        // Draw the blocks for the next piece
        for (let y = 0; y < matrix.length; y++) {
             if (!matrix[y]) continue; // Skip if row doesn't exist
            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x]) {
                     // Check image/color again before creating block
                     if (typeof image !== 'undefined' && typeof color !== 'undefined') {
                          const block = createBlock(
                              elements.nextPiece, // Parent is the inner next-piece div
                              offsetX + (x * cellSize),
                              offsetY + (y * cellSize),
                              image,
                              color
                          );
                          // Ensure block creation succeeded before setting size
                          if (block) {
                              block.style.width = cellSize + 'px';
                              block.style.height = cellSize + 'px';
                          }
                     } else {
                          console.warn(`Skipping rendering next piece block at [${y}][${x}] due to missing image/color.`);
                     }
                }
            }
        }
    }

    // --- Event Handlers ---

    // Handles resizing of the window
    // handleResize function *** (Using Percentage-Based Sizing with Checks) ***
    function handleResize() {
        console.log("--- handleResize called ---");
        // console.log("Checking config:", config); // Can be commented out if stable
        // console.log("Checking config.board:", config.board); // Can be commented out if stable

        // Calculate available space (use viewport)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        console.log("Viewport:", viewportWidth, "x", viewportHeight);

        // Use a large percentage of the viewport for available space calculation
        let availableWidth = viewportWidth * 0.95; // Use 95% of width
        let availableHeight = viewportHeight * 0.90; // Use 90% of height

        console.log("Available space (New Calc):", availableWidth, "x", availableHeight);

        // Calculate block size based on board ratio and available space
        let blockSizeW = 0;
        let blockSizeH = 0;
        if (config && config.board && config.board.width > 0 && config.board.height > 0) { // Ensure valid divisor
             blockSizeW = Math.floor(availableWidth / config.board.width);
             blockSizeH = Math.floor(availableHeight / config.board.height);
        } else {
            console.error("Config.board dimensions are invalid in handleResize!");
            game.blockSize = 4; // Use minimum fallback size
        }
        console.log("BlockSize W/H:", blockSizeW, "/", blockSizeH);

        // Determine final block size, ensuring a minimum
        // Use calculated values only if they are valid numbers
        const validBlockSizeW = Number.isFinite(blockSizeW) ? blockSizeW : 0;
        const validBlockSizeH = Number.isFinite(blockSizeH) ? blockSizeH : 0;
        game.blockSize = Math.max(4, Math.min(validBlockSizeW, validBlockSizeH));
        console.log("Final blockSize:", game.blockSize);


        // Calculate actual board dimensions
        let boardWidth = 0;
        let boardHeight = 0;
        if (config && config.board) {
             boardWidth = game.blockSize * config.board.width;
             boardHeight = game.blockSize * config.board.height;
        }
        console.log("Calculated Board Size:", boardWidth, "x", boardHeight);


        // Set the size of the board and wrapper elements if dimensions are valid
        if (boardWidth > 0 && boardHeight > 0 && elements.board && elements.gameAreaWrapper) {
            elements.board.style.width = boardWidth + 'px';
            elements.board.style.height = boardHeight + 'px';
            elements.gameAreaWrapper.style.width = boardWidth + 'px';
            elements.gameAreaWrapper.style.height = boardHeight + 'px';
            console.log("Applied styles to board and wrapper");
        } else {
             console.error("Calculated board dimensions are invalid or elements missing!", boardWidth, boardHeight);
        }

        // Redraw the game or initial grid based on game state
        if (game.gameStarted && !game.isPaused && !game.isGameOver) {
             console.log("Drawing game state (from handleResize)");
             draw();
        } else if (!game.gameStarted) {
             console.log("Drawing initial grid (from handleResize)");
             // Ensure board element exists before manipulating
             if (elements.board && elements.board.style.display !== 'none') {
                elements.board.innerHTML = ''; // Clear board
                if (boardWidth > 0 && boardHeight > 0){ // Only create grid if size is valid
                   createGrid(); // Draw grid based on new size
                }
             }
        }

         // Re-draw next piece preview explicitly after resize
         if (game && elements.nextPiece) {
             // Draw next piece only if it exists (might not exist before game starts)
             if (game.nextPiece) {
                  console.log("Drawing next piece (from handleResize)");
                  elements.nextPiece.innerHTML = ''; // Clear previous preview first
                  drawNextPiece();
             } else {
                  elements.nextPiece.innerHTML = ''; // Ensure it's clear if no next piece
             }
         }
         console.log("--- handleResize finished ---");
    }

    // Handles keyboard input
    function handleKeyPress(event) {
        // Ignore keypresses if game isn't running (except potentially pause)
        if (game.isGameOver || !game.gameStarted) {
            return;
        }
        // If paused, only allow the 'P' key (keyCode 80) to unpause
        if (game.isPaused && event.keyCode !== 80) return;

        switch (event.keyCode) {
            case 37: // Left Arrow
                 movePiece(-1);
                 event.preventDefault(); // Prevent window scrolling
                 break;
            case 39: // Right Arrow
                 movePiece(1);
                 event.preventDefault();
                 break;
            case 38: // Up Arrow
                 rotatePiece();
                 event.preventDefault();
                 break;
            case 40: // Down Arrow
                 moveDown(); // Soft drop
                 event.preventDefault();
                 break;
            case 32: // Spacebar
                 hardDrop();
                 event.preventDefault();
                 break;
            case 80: // 'P' key
                 togglePause();
                 event.preventDefault();
                 break;
        }
    }

    // Handles touch start event on the board
    function handleTouchStart(e) {
        if (game.isGameOver || game.isPaused || !game.gameStarted || e.touches.length !== 1) return;
        e.preventDefault(); // Prevent default touch actions like scrolling on the board

        const t = e.touches[0];
        touch.startX = t.clientX;
        touch.startY = t.clientY;
        touch.currentX = t.clientX; // Track current X for incremental move
        touch.startTime = Date.now();
        touch.isDragging = false;
        touch.isSwipedDown = false;
        touch.movedHorizontally = false; // Reset flag
    }

    // Handles touch move event on the board
    function handleTouchMove(e) {
         if (game.isGameOver || game.isPaused || !game.gameStarted || !touch.startTime || e.touches.length !== 1) return;
         e.preventDefault(); // Prevent default actions during move as well

         const t = e.touches[0];
         const deltaXTotal = t.clientX - touch.startX; // Total horizontal movement since start
         const deltaYTotal = t.clientY - touch.startY; // Total vertical movement since start
         const deltaXInstant = t.clientX - touch.currentX; // Movement since last move event

         // Check configuration exists before using touch thresholds
         if (!config || !config.touch) return;

         const moveThresholdPixels = game.blockSize * config.touch.moveThresholdRatio;

         // Horizontal Movement Detection (Incremental)
         if (Math.abs(deltaXInstant) > moveThresholdPixels) {
             const direction = deltaXInstant > 0 ? 1 : -1;
             if (movePiece(direction)) { // Attempt to move the piece
                 touch.currentX = t.clientX; // Update position only if move succeeded
                 touch.movedHorizontally = true; // Flag that a horizontal move occurred
                 touch.isDragging = true; // Mark as dragging to differentiate from tap
             }
         }

         // Vertical Swipe Down Detection (for Hard Drop)
         // Check only if not already swiped and vertical movement is significant & dominant
         if (!touch.isSwipedDown &&
             deltaYTotal > config.touch.swipeDownThreshold &&
             Math.abs(deltaYTotal) > Math.abs(deltaXTotal) * 1.5) // Ensure swipe is mostly vertical
         {
             console.log("Hard drop detected (swipe)");
             touch.isSwipedDown = true; // Flag that swipe occurred
             hardDrop();
             touch.startTime = 0; // End this touch sequence after hard drop action
         }
    }

    // Handles touch end event on the board
    function handleTouchEnd(e) {
        if (game.isGameOver || game.isPaused || !game.gameStarted || !touch.startTime) return;
        // No preventDefault usually needed for touchend itself

        const touchDuration = Date.now() - touch.startTime;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        // Calculate total distance moved during the touch
        const totalMoveDistance = Math.sqrt(Math.pow(endX - touch.startX, 2) + Math.pow(endY - touch.startY, 2));

        // Check configuration exists before using touch thresholds
        if (!config || !config.touch) return;

        // Tap Detection (for Rotate)
        // Check if it wasn't a swipe down, wasn't a horizontal drag, was short duration, and minimal movement
        if (!touch.isSwipedDown &&
            !touch.movedHorizontally &&
            touchDuration < config.touch.tapTimeout &&
            totalMoveDistance < config.touch.dragThreshold * 1.5) // Allow slightly more movement for tap detection
        {
            console.log("Tap detected (rotate)");
            rotatePiece();
        }

        // Reset touch tracking state for the next touch
        touch.startTime = 0;
        touch.isDragging = false;
        touch.isSwipedDown = false;
        touch.movedHorizontally = false;
    }


    // --- Initialization and Event Listener Setup ---

    // Sets up event listeners needed *during* active gameplay
    function setupGameplayEventListeners() {
         // Ensure board element exists before adding listeners
         if (!elements.board) return;

         // Remove previous gameplay listeners first (safety measure)
         elements.board.removeEventListener('touchstart', handleTouchStart);
         elements.board.removeEventListener('touchmove', handleTouchMove);
         elements.board.removeEventListener('touchend', handleTouchEnd);
         document.removeEventListener('keydown', handleKeyPress);

        // Add listeners for touch and keyboard controls
        // Use passive: false for touch events on the board to allow preventDefault()
        elements.board.addEventListener('touchstart', handleTouchStart, { passive: false });
        elements.board.addEventListener('touchmove', handleTouchMove, { passive: false });
        elements.board.addEventListener('touchend', handleTouchEnd, { passive: false });
        document.addEventListener('keydown', handleKeyPress); // Listen globally for keyboard
    }

    // Sets up event listeners that are always active (buttons, resize)
    function setupInitialEventListeners() {
        // Ensure button elements exist before adding listeners
        if (elements.startButton) {
             elements.startButton.addEventListener('click', startGame);
        }
        if (elements.restartButton) {
             elements.restartButton.addEventListener('click', startGame);
        }
        // Always listen for window resize
        window.addEventListener('resize', handleResize);
    }

    // Sets up the legend images (if used)
    function setupLegend() {
        if (!tetrominoes || !tetrominoes.images || !tetrominoes.colors) return; // Need data

        for (let i = 0; i < tetrominoes.images.length; i++) {
            const previewElement = document.getElementById(`image${i + 1}-preview`);
            if (previewElement) {
                // Set background image to the specific block image
                previewElement.style.backgroundImage = `url(${tetrominoes.images[i]})`;
                // Set fallback background color
                 // Ensure color exists before setting
                 if(tetrominoes.colors[i]) {
                     previewElement.style.backgroundColor = tetrominoes.colors[i];
                 }
            }
        }
    }


    // Initialize the game environment
    function init() {
        console.log("Initializing Tetris...");
        setupLegend(); // Set up legend images if they exist in HTML
        setupInitialEventListeners(); // Setup buttons, resize listener
        handleResize(); // Calculate initial sizes and draw empty grid/background
        console.log("Initialization Complete. Ready to start.");
        // Game loop doesn't start until 'startGame' is called by button press
    }

    // --- Start the initialization process ---
    init();

}); // End of DOMContentLoaded listener