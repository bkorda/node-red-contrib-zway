module.exports = function(RED) {
    class zwayItemBattery {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.on('onClose', () => this.onClose());
                node.server.on('onSocketError', () => this.onSocketError());
                node.server.on('onSocketClose', () => this.onSocketClose());
                node.server.on('onSocketOpen', () => this.onSocketOpen());
                node.server.on('onSocketPongTimeout', () => this.onSocketPongTimeout());
                node.server.on('onNewDevice', (uniqueid) => this.onNewDevice(uniqueid));

                node.sendLastState();
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/battery:status.server_node_error"
                });
            }
        }


        sendState(device) {
            var node = this;

            if (device.metrics !== undefined) {
                var battery = null;
                if (device.deviceType === 'battery') {
                    battery = device.metrics;
                }

                //status
                if (battery) {
                    //status
                    if (battery.isFailed) {
                        node.status({
                            fill: "red",
                            shape: "ring",
                            text: "node-red-contrib-zway/battery:status.not_reachable"
                        });
                    } else {
                        node.status({
                            fill:  (battery.level >= 20)? ((battery.level >= 50) ? "green" : "yellow") : "red",
                            shape: "dot",
                            text: battery.level+'%'
                        });
                    }
                }

                //outputs
                node.send([
                    battery,
                    node.formatHomeKit(battery)
                ]);
            }
        }

        sendLastState() {
            var node = this;
            var uniqueid = node.config.device;
            if (typeof (node.config.device) == 'string' && node.config.device.length) {
                var deviceMeta = node.server.getDevice(uniqueid);
                if (deviceMeta) {
                    node.server.devices[node.id] = uniqueid;
                    node.meta = deviceMeta;
                    if (node.config.outputAtStartup) {
                        setTimeout(function(){
                            node.sendState(deviceMeta);
                        }, 1500); //we need this timeout after restart of node-red  (homekit delays)
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-zway/battery:status.disconnected"
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/battery:status.device_not_set"
                });
            }
        }

        formatHomeKit(battery) {
            var msg = {};
            var characteristic = {};

            //battery status
            if (battery !== undefined) {
                characteristic.BatteryLevel = parseInt(battery.level);
                characteristic.StatusLowBattery = parseInt(battery.level) <= 15 ? 1 : 0;

                msg.payload = characteristic;
                return msg;
            }

            return null;
        }

        onSocketPongTimeout() {
            var node = this;
            node.onSocketError();
        }

        onSocketError() {
            var node = this;
            node.status({
                fill: "yellow",
                shape: "dot",
                text: "node-red-contrib-zway/battery:status.reconnecting"
            });
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
                text: "node-red-contrib-zway/battery:status.disconnected"
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
    RED.nodes.registerType('zway-battery', zwayItemBattery);
};


