'use strict';
// Verification only: deny non-loopback connections before DNS/socket use.
// Guard for trusted checks; not an OS sandbox or an integration test.
const net = require('node:net');
function isLoopback(host) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(String(host).toLowerCase());
}
function refused() {
  const error = new Error('Clinia offline verification refuses external network access');
  error.code = 'CLINIA_CI_NETWORK_REFUSED';
  return error;
}
function socketHost(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (first && typeof first === 'object') {
    if (first.path) return null; // Local IPC, including Next worker channels.
    return first.host || 'localhost';
  }
  if (typeof first === 'string' && !/^\d+$/.test(first)) return null;
  return typeof args[1] === 'string' ? args[1] : 'localhost';
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const host = socketHost(args);
  if (host !== null && !isLoopback(host)) throw refused();
  return connect.apply(this, args);
};
const fetch = globalThis.fetch;
globalThis.fetch = async function (input, ...args) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['http:', 'https:'].includes(url.protocol) || !isLoopback(url.hostname)) throw refused();
  return fetch.call(this, input, ...args);
};
module.exports = { isLoopback, socketHost };
