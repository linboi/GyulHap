const grid = document.getElementById('grid');
const message = document.getElementById('message');
const foundSetsList = document.getElementById('found-sets');
let squares = [];
let selectedSquares = [];
let foundSets = [];
let gameEnded = false;

const socket = io('wss://gyulhap.onrender.com'); // Use wss:// for secure WebSocket connections

let playerName = localStorage.getItem('playerName') || `Player${Math.floor(Math.random() * 1000)}`;
let isHost = false;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('create-lobby')?.addEventListener('click', () => {
        const inputName = document.getElementById('player-name').value.trim();
        if (!inputName) {
            alert('Please enter your name before creating a lobby.');
            return;
        }
        playerName = inputName;
        localStorage.setItem('playerName', playerName);

        socket.emit('createLobby', playerName);
    });

    document.getElementById('join-lobby')?.addEventListener('click', () => {
        const inputName = document.getElementById('player-name').value.trim();
        const lobbyCode = document.getElementById('lobby-code').value.trim();

        if (!inputName || !lobbyCode) {
            alert('Please enter your name and lobby code.');
            return;
        }

        playerName = inputName; // Update playerName with the input value
        localStorage.setItem('playerName', playerName); // Store playerName in localStorage
        localStorage.setItem('lobbyCode', lobbyCode); // Store lobbyCode in localStorage

        console.log(`Emitting joinLobby with code: ${lobbyCode}, player: ${playerName}`); // Debug log
        socket.emit('joinLobby', { lobbyCode, playerName }); // Emit the joinLobby event
    });

    // Listen for the gameGrid event on the game.html page
    socket.on('gameGrid', (gameGrid) => {
        console.log('Received game grid on game.html:', gameGrid); // Debug log
        renderGrid(gameGrid); // Render the received grid
    });

    // If the player is already in a lobby and the game has started, request the game grid
    const lobbyCode = localStorage.getItem('lobbyCode');
    if (lobbyCode) {
        socket.emit('requestGameGrid', lobbyCode);
    }

    // Rejoin the lobby if the player is already in one
    if (lobbyCode) {
        const playerName = localStorage.getItem('playerName');
        if (playerName) {
            console.log(`Rejoining lobby ${lobbyCode} as ${playerName}`); // Debug log
            socket.emit('joinLobby', { lobbyCode, playerName });
        }
    }
});

socket.on('lobbyCreated', (lobbyCode) => {
    isHost = true;
    showLobbyView(lobbyCode);
});

socket.on('lobbyJoined', (lobbyCode) => {
    localStorage.setItem('lobbyCode', lobbyCode); // Store the correct lobby code
    showLobbyView(lobbyCode); // Display the correct lobby code
});

socket.on('updatePlayers', (players) => {
    const playerList = document.getElementById('player-list');
    if (!playerList) return;

    playerList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        if (player === playerName) {
            li.classList.add('highlighted-name');
        }
        playerList.appendChild(li);
    });
});

socket.on('gameStarted', () => {
    console.log('Game started! Rendering the game view.'); // Debug log

    // Hide the lobby container and show the game container
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';

    // Initialize the game grid
    //renderGrid();
});

socket.on('gameGrid', (gameGrid) => {
    console.log('Received game grid:', gameGrid); // Debug log
    renderGrid(gameGrid); // Render the received grid
});

socket.on('updateScores', (scores) => {
    const scoreContainer = document.getElementById('score-container');
    scoreContainer.innerHTML = '<h3>Scoreboard:</h3>';
    for (const [player, score] of Object.entries(scores)) {
        const scoreItem = document.createElement('div');
        scoreItem.textContent = `${player}: ${score}`;
        scoreContainer.appendChild(scoreItem);
    }
});

socket.on('updateFoundSets', (foundSets) => {
    foundSetsList.innerHTML = ''; // Clear the list
    foundSets.forEach(set => {
        const listItem = document.createElement('li');
        listItem.textContent = `Set: ${set}`;
        foundSetsList.appendChild(listItem);
    });
});

socket.on('setFeedback', ({ success, message: feedbackMessage }) => {
    message.textContent = feedbackMessage; // Display the feedback message
    message.style.color = success ? 'green' : 'red'; // Use green for success and red for failure
});

function showLobbyView(lobbyCode) {
    document.getElementById('initial-container').style.display = 'none';
    document.getElementById('lobby-container').style.display = 'block';
    document.getElementById('current-lobby-code').textContent = lobbyCode; // Update the displayed lobby code
    document.getElementById('user-name').textContent = playerName;

    if (isHost) {
        document.getElementById('start-game').style.display = 'block';
    }
}

// Generate random properties for squares ensuring uniqueness
function generateUniqueSquares() {
    const backgrounds = ['white', 'black', 'grey'];
    const shapes = ['circle', 'square', 'triangle'];
    const colors = ['red', 'green', 'blue'];

    const allCombinations = [];
    backgrounds.forEach(background => {
        shapes.forEach(shape => {
            colors.forEach(color => {
                allCombinations.push({ background, shape, color });
            });
        });
    });

    // Shuffle combinations and pick the first 9
    for (let i = allCombinations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCombinations[i], allCombinations[j]] = [allCombinations[j], allCombinations[i]];
    }

    return allCombinations.slice(0, 9);
}

// Render the grid
function renderGrid(gridData) {
    grid.innerHTML = '';
    squares = gridData;

    squares.forEach((square, index) => {
        const div = document.createElement('div');
        div.className = 'square';
        div.style.backgroundColor = square.background;

        const numberDiv = document.createElement('div');
        numberDiv.className = 'number';
        numberDiv.textContent = index + 1;

        const shapeDiv = document.createElement('div');
        shapeDiv.className = `shape ${square.shape}`;
        if (square.shape === 'triangle') {
            shapeDiv.style.borderBottomColor = square.color;
        } else {
            shapeDiv.style.backgroundColor = square.color;
        }

        div.appendChild(numberDiv);
        div.appendChild(shapeDiv);
        div.addEventListener('click', () => toggleSelection(index));
        grid.appendChild(div);
    });
}

// Toggle square selection
function toggleSelection(index) {
    const squareDiv = grid.children[index];
    if (selectedSquares.includes(index)) {
        selectedSquares = selectedSquares.filter(i => i !== index);
        squareDiv.classList.remove('selected');
    } else if (selectedSquares.length < 3) {
        selectedSquares.push(index);
        squareDiv.classList.add('selected');
    }
}

// Validate the selected set
function validateSet() {
    if (selectedSquares.length !== 3) {
        message.textContent = 'Select exactly 3 squares.';
        return false;
    }

    const setNumbers = selectedSquares.map(i => i + 1).sort((a, b) => a - b).join(', ');
    const lobbyCode = localStorage.getItem('lobbyCode');
    socket.emit('submitSet', { lobbyCode, playerName, set: setNumbers }); // Submit the set to the server

    selectedSquares = [];
    document.querySelectorAll('.square.selected').forEach(square => square.classList.remove('selected'));
    return true; // Always return true to indicate the set was submitted
}

// Check if no more sets exist
function noMoreSets() {
    if (gameEnded) return;

    const lobbyCode = localStorage.getItem('lobbyCode');
    if (lobbyCode) {
        socket.emit('checkNoMoreSets', { lobbyCode, playerName }); // Include playerName in the request
    } else {
        message.textContent = 'Error: Lobby code not found.';
    }
}

// Listen for server response on no more sets
socket.on('noMoreSetsResult', ({ noMoreSets }) => {
    if (noMoreSets) {
        message.textContent = 'No more valid sets! Game Over!';
        endGame(); // End the game
    } else {
        message.textContent = 'There are still valid sets.';
    }
});

// Show all valid sets
function showValidSets() {
    const validSetsContainer = document.getElementById('valid-sets-container');
    const validSetsList = document.getElementById('valid-sets');
    validSetsList.innerHTML = ''; // Clear previous list

    // Remove client-side logic for finding valid sets
    validSetsContainer.style.display = 'block'; // Unhide the container
}

// End the game and show the play again button
function endGame() {
    gameEnded = true;
    document.getElementById('play-again-container').style.display = 'block';
}

// Reset the game
function resetGame() {
    gameEnded = false;
    foundSets = [];
    selectedSquares = [];
    foundSetsList.innerHTML = '';
    message.textContent = '';
    document.getElementById('valid-sets-container').style.display = 'none';
    document.getElementById('play-again-container').style.display = 'none';
    renderGrid();
}

// Event listeners
document.getElementById('submit-guess').addEventListener('click', validateSet);
document.getElementById('no-more-sets').addEventListener('click', noMoreSets);
document.getElementById('show-valid-sets').addEventListener('click', showValidSets);
document.getElementById('play-again').addEventListener('click', resetGame);

document.getElementById('play-again').addEventListener('click', () => {
    const lobbyCode = localStorage.getItem('lobbyCode');
    if (lobbyCode) {
        console.log('Play Again button clicked. Restarting the game.'); // Debug log
        socket.emit('startGame'); // Emit startGame event to the server
    } else {
        console.error('Lobby code not found. Cannot restart the game.'); // Debug log
    }
});

// Remove the direct call to renderGrid at the end of the script
// Ensure the grid is only rendered when valid data is received from the server
