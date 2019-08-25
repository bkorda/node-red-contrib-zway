module.exports = function(RED) {
    class zWayItemIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;

            // //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.on('onClose', () => this.onClose());
                node.server.on('onSocketError', () => this.onSocketError());
                node.server.on('onSocketClose', () => this.onSocketClose());
                node.server.on('onSocketOpen', () => this.onSocketOpen());
                node.server.on('onSocketPongTimeout', () => this.onSocketPongTimeout());
                node.server.on('onNewDevice', (uniqueid) => this.onNewDevice(uniqueid));

                // node.sendLastState(); //tested for duplicate send with onSocketOpen
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/in:status.server_node_error"
                });
            }
        }

        sendLastState() {
            var node = this;
            if (typeof (node.config.device) == 'string' && node.config.device.length) {
                var deviceMeta = node.server.getDevice(node.config.device);
                if (deviceMeta !== undefined && deviceMeta && "uniqueid" in deviceMeta) {
                    node.server.devices[node.id] = deviceMeta.uniqueid;
                    node.meta = deviceMeta;
                    if (node.config.outputAtStartup) {
                        setTimeout(function () {
                            node.sendState(deviceMeta,true);
                        }, 1500); //we need this timeout after restart of node-red  (homekit delays)
                    } else {
                        setTimeout(function () {
                            node.status({}); //clean
                            node.getState(deviceMeta);
                            node.sendStateHomekitOnly(deviceMeta); //always send for homekit
                        }, 1500); //update status with the same delay
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-deconz/in:status.disconnected"
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.device_not_set"
                });
            }
        }

        sendState(device,force=false) {
            var node = this;
            device = node.getState(device);
            if(!device) { return; }

            //filter output
            if (!force && 'onchange' === node.config.output && device.state[node.config.state] === node.oldState) return;
            if (!force && 'onupdate' === node.config.output && device.state['lastupdated'] === node.prevUpdateTime) return;

            //outputs
            node.send([
                {
                    payload: (node.config.state in device.state) ? device.state[node.config.state] : device.state,
                    payload_raw: device,
                    meta: node.server.getDevice(node.config.device)
                },
                node.formatHomeKit(device)
            ]);

            node.oldState = device.state[node.config.state];
            node.prevUpdateTime = device.state['lastupdated'];
        };

        sendStateHomekitOnly(device) {
            var node = this;
            device = node.getState(device);
            if(!device) { return; }

            //outputs
            node.send([
                null,
                // node.formatHomeKit(device)
            ]);
        };

        onSocketPongTimeout() {
            var node = this;
            node.onSocketError();
        }

        onSocketError() {
            var node = this;
            node.status({
                fill: "yellow",
                shape: "dot",
                text: "node-red-contrib-deconz/in:status.reconnecting"
            });

            //send NO_RESPONSE
            var deviceMeta = node.server.getDevice(node.config.device);
            if (deviceMeta) {
                node.send([
                    null,
                    node.formatHomeKit(deviceMeta, {reachable:false})
                ]);
            }
        }

        onClose() {
            var node = this;
            node.onSocketClose();
        }

        onSocketClose() {
            var node = this;
            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-deconz/in:status.disconnected"
            });
        }

        onSocketOpen() {
            var node = this;
            node.sendLastState();
        }

        onNewDevice(uniqueid) {
            var node = this;
            if (node.config.device === uniqueid) {
                node.sendLastState();
            }
        }
    }
    RED.nodes.registerType('zway-input', zWayItemIn);
};


