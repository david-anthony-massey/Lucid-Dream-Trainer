const { app, BrowserWindow } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs');

let window;
// document.getElementById('').textContent;

function createWindow() {
  window = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: true, // <--- flag
      nodeIntegrationInWorker: true, // <---  for web workers
    },
  });
  const startURL = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  window.loadURL(startURL);

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    window = null;
  });
}

app.on('ready', createWindow);
