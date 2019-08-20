module.exports = function(RED) {
    class zWayItemIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;

            // //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
            
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/in:status.server_node_error"
                });
            }
        }
    }
    RED.nodes.registerType('zway-input', zWayItemIn);
};


