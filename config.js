const ENV = 'release'; // Change to 'release' for production

const CONFIG = {
    debug: {
        SOCKET_DOMAIN: 'http://192.168.0.4:3000', // Localhost for debugging
    },
    release: {
        SOCKET_DOMAIN: 'https://gyulhap.onrender.com', // Production domain
    },
};

window.SOCKET_DOMAIN = CONFIG[ENV].SOCKET_DOMAIN; // Expose SOCKET_DOMAIN globally
