const socket = io('http://192.168.0.4:3000'); // Explicitly specify the server URL

let playerName = localStorage.getItem('playerName') || `Player${Math.floor(Math.random() * 1000)}`;
let isHost = false;
let hasJoinedLobby = false; // Flag to prevent multiple join events

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyCode = urlParams.get('code') || localStorage.getItem('lobbyCode');

    if (lobbyCode) {
        showLobbyInfo(lobbyCode);
    }

    const userNameDisplay = document.getElementById('user-name');
    if (userNameDisplay) {
        userNameDisplay.textContent = playerName;
    }
});

const setNameButton = document.getElementById('set-name');
if (setNameButton) { // Ensure the button exists before adding the event listener
    setNameButton.addEventListener('click', () => {
        playerName = document.getElementById('player-name').value || playerName;
        localStorage.setItem('playerName', playerName); // Store playerName in localStorage
        const userNameDisplay = document.getElementById('user-name');
        if (userNameDisplay) {
            userNameDisplay.textContent = playerName; // Update the user's name in the waiting room
        }
    });
}

document.getElementById('create-lobby')?.addEventListener('click', () => {
    const inputName = document.getElementById('player-name').value.trim();
    if (inputName) {
        playerName = inputName; // Update playerName with the input value
        localStorage.setItem('playerName', playerName); // Store playerName in localStorage
    }
    console.log(socket.connected);
    socket.emit('createLobby', playerName);
});

document.getElementById('join-lobby')?.addEventListener('click', () => {
    console.log('Join Lobby button clicked'); // Debug log

    const lobbyCode = document.getElementById('lobby-code')?.value.trim();
    const inputName = document.getElementById('player-name')?.value.trim();

    if (!lobbyCode) {
        console.error('Lobby code is missing'); // Debug log
        alert('Please enter a valid lobby code.');
        return;
    }

    if (inputName) {
        playerName = inputName; // Update playerName with the input value
        localStorage.setItem('playerName', playerName); // Store playerName in localStorage
    } else if (!playerName) {
        alert('Please enter your name before joining a lobby.');
        return;
    }

    console.log('Joining lobby with code:', lobbyCode, 'as player:', playerName); // Debug log
    localStorage.setItem('lobbyCode', lobbyCode); // Store lobbyCode in localStorage
    socket.emit('joinLobby', { lobbyCode, playerName });
});

socket.on('connect', () => {
    console.log('Socket connected successfully:', socket.id); // Debug log
    console.log('Socket connected:', socket.connected); // Debug log

    // Automatically rejoin the lobby if the client reconnects
    const lobbyCode = localStorage.getItem('lobbyCode');
    if (lobbyCode && !hasJoinedLobby) {
        console.log(`Rejoining lobby ${lobbyCode} as ${playerName}`); // Debug log
        socket.emit('joinLobby', { lobbyCode, playerName });
        hasJoinedLobby = true; // Prevent multiple join attempts
    }
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error); // Debug log
});

socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason); // Debug log
});

socket.on('lobbyCreated', (lobbyCode) => {
    isHost = true; // Set the host flag
    localStorage.setItem('lobbyCode', lobbyCode); // Store the correct lobby code
    redirectToLobby(lobbyCode); // Display the correct lobby code
});

socket.on('lobbyJoined', (lobbyCode) => {
    console.log('Successfully joined lobby:', lobbyCode); // Debug log
    hasJoinedLobby = true; // Set the flag only after successfully joining
    localStorage.setItem('lobbyCode', lobbyCode); // Store the correct lobby code
    showLobbyInfo(lobbyCode); // Display the correct lobby code
});

socket.on('updatePlayers', (players) => {
    console.log('Received updatePlayers event:', players); // Debug log

    const playerList = document.getElementById('player-list');
    if (!playerList) {
        console.error('Player list element not found in the DOM'); // Debug log
        return;
    }

    playerList.innerHTML = ''; // Clear the existing list
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player; // Add each player's name to the list
        if (player === playerName) {
            li.classList.add('highlighted-name'); // Highlight the current player's name
        }
        playerList.appendChild(li); // Append the player to the list
    });
});

socket.on('gameStarted', () => {
    const lobbyCode = localStorage.getItem('lobbyCode');
    const playerName = localStorage.getItem('playerName');
    console.log(`Game started! Redirecting to game.html. Lobby: ${lobbyCode}, Player: ${playerName}`); // Debug log

    // Redirect to game.html
    window.location.href = 'game.html';
});

document.addEventListener('DOMContentLoaded', () => {
    const startGameButton = document.getElementById('start-game');
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            if (isHost) {
                console.log('Host is starting the game'); // Debug log
                socket.emit('startGame'); // Emit startGame event to the server
            }
        });
    }
});

function redirectToLobby(lobbyCode) {
    console.log(`Redirecting to lobby with code: ${lobbyCode}`); // Debug log
    // Prevent unnecessary page reloads by dynamically updating the UI
    showLobbyInfo(lobbyCode);
}

function showLobbyInfo(lobbyCode) {
    console.log('Joining lobby with code:', lobbyCode); // Debug log
    document.getElementById('current-lobby-code').textContent = lobbyCode; // Update the displayed lobby code

    if (!hasJoinedLobby) { // Emit joinLobby only if not already joined
        hasJoinedLobby = true; // Set the flag to true
        document.getElementById('current-lobby-code').textContent = lobbyCode;
        socket.emit('joinLobby', { lobbyCode, playerName });
    }

    const startGameButton = document.getElementById('start-game');
    if (isHost && startGameButton) {
        startGameButton.style.display = 'block'; // Show the start button for the host
    }
}
