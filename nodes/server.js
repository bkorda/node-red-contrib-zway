// var request = require('request');
// var zway = require('node-zway');

module.exports = function(RED) {
    class ServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);
            var node = this;
            node.name = n.name;
            node.ip = n.ip;
            node.port = n.port;
            node.login = n.login;
            node.pass = n.pass;
        }
    }

    RED.nodes.registerType('zway-server', ServerNode);
};

