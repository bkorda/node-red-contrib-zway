module.exports = function(RED) {
    class zwayItemGet {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;

            node.config = config;
            node.cleanTimer = null;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                if (typeof (node.config.device) == 'string' && node.config.device.length) {
                    var deviceMeta = node.server.getDevice(node.config.device);
                    if (deviceMeta !== undefined && deviceMeta && "id" in deviceMeta) {
                        node.server.devices[node.id] = deviceMeta.id; //regisgter node in devices list
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-zway/get:status.device_not_set"
                        });
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-zway/get:status.device_not_set"
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/get:status.server_node_error"
                });
            }

            if (typeof(config.device) == 'string'  && config.device.length) {
                node.status({}); //clean

                node.on('input', function (message) {
                    clearTimeout(node.cleanTimer);
                    var deviceMeta = node.server.getDevice(node.config.device);

                    if (deviceMeta) {
                        node.server.devices[node.id] = deviceMeta.id;
                        node.meta = deviceMeta;

                        //status
                        if ("metrics" in deviceMeta && "isFailed" in deviceMeta.metrics && deviceMeta.metrics.isFailed === true) {
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: "node-red-contrib-zway/get:status.not_reachable"
                            });
                        } else {
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: "node-red-contrib-zway/get:status.received",
                            });

                            node.send({
                                payload: node.meta.metrics,
                                meta:deviceMeta,
                            });
                        }

                        node.cleanTimer = setTimeout(function(){
                            node.status({}); //clean
                        }, 3000);
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-zway/get:status.device_not_set"
                        });
                    }

                });
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/get:status.device_not_set"
                });
            }
        }
    }

    RED.nodes.registerType('zway-get', zwayItemGet);
};
