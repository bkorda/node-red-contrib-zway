var request = require('request');
const ZWaySocket = require('../lib/zway-socket');

module.exports = function(RED) {
    class ServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);

            var node = this;

            node.discoverProcess = false;
            node.name = n.name;
            node.ip = n.ip;
            node.port = n.port;
            node.login = n.login;
            node.pass = n.pass;
            node.secure = n.secure || false;
            node.devices = {};

            node.setMaxListeners(255);
            node.refreshDiscoverTimer = null;
            node.refreshDiscoverInterval = 15000;

            node.socket = new ZWaySocket({
                hostname: this.ip,
                secure: this.secure
            });

            node.socket.on('close', (code, reason) => this.onSocketClose(code, reason));
            node.socket.on('unauthorized', () => this.onSocketUnauthorized());
            node.socket.on('open', () => this.onSocketOpen());
            node.socket.on('message', (payload) => this.onSocketMessage(payload));
            node.socket.on('error', (err) => this.onSocketError(err));
            node.socket.on('pong-timeout', () => this.onSocketPongTimeout());

            node.on('close', () => this.onClose());

            node.discoverDevices(function(){}, true);

            this.refreshDiscoverTimer = setInterval(function () {
                node.discoverDevices(function(){}, true);
            }, node.refreshDiscoverInterval);
        }

        discoverDevices(callback, forceRefresh = false) {

        }

        getDiscoverProcess() {
            var node = this;
            return node.discoverProcess;
        }

        getDevice(uniqueid) {
            
        }

        getItemsList(callback, forceRefresh = false) {
            
        }

        onClose() {
            var that = this;
            that.warn('WebSocket connection closed');
            that.emit('onClose');

            clearInterval(that.refreshDiscoverTimer);
            that.socket.close();
            that.socket = null;
        }

        onSocketPongTimeout() {
            var that = this;
            that.warn('WebSocket connection timeout, reconnecting');
            that.emit('onSocketPongTimeout');
        }

        onSocketUnauthorized() {
            var that = this;
            that.warn('WebSocket authentication failed');
            that.emit('onSocketUnauthorized');
        }

        onSocketError(err) {
            var that = this;
            that.warn(`WebSocket error: ${err}`);
            that.emit('onSocketError');
        }

        onSocketClose(code, reason) {
            var that = this;
            if (reason) { // don't bother the user unless there's a reason
                that.warn(`WebSocket disconnected: ${code} - ${reason}`);
            }
            that.emit('onSocketClose');
        }

        onSocketOpen(err) {
            var that = this;
            that.log(`WebSocket opened`);
            that.emit('onSocketOpen');
        }

        onSocketMessage(dataParsed) {
            var that = this;
            that.log(dataParsed);
            that.emit('onSocketMessage', dataParsed);
        }
    }

    RED.nodes.registerType('zway-server', ServerNode);
};

