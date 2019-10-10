var request = require('request');

module.exports = function(RED) {
    class ZWayOut {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;

            node.status({}); //clean

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.devices[node.id] = node.config.device; //register node in devices list

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/out:status.server_node_error"
                });
            }

            node.payload = config.payload;
            node.command = config.command;
            node.payloadType = config.payloadType;
            node.commandType = config.commandType;
            node.cleanTimer = null;

            // if (typeof(config.device) == 'string'  && config.device.length) {


                this.on('input', function (message) {
                    clearTimeout(node.cleanTimer);

                    var payload;
                    switch (node.payloadType) {
                        case 'flow':
                        case 'global': 
                            RED.util.evaluateNodeProperty(node.payload, node.payloadType, this, message, function (error, result) {
                                if (error) {
                                    node.error(error, message);
                                } else {
                                    payload = result;
                                }
                            });
                            break;
                        
                        case 'date': 
                            payload = Date.now();
                            break;
                        
                        case 'zway_payload':
                            payload = node.payload;
                            break;

                        case 'num': 
                            payload = parseInt(node.config.payload);
                            break;
                        

                        case 'str': 
                            payload = node.config.payload;
                            break;
                        

                        case 'homekit':
                        case 'msg':
                        default: 
                            payload = message[node.payload];
                            break;
                        
                    }

                    var command;
                    switch (node.commandType) {
                        case 'msg': {
                            command = message[node.command];
                            break;
                        }
                        case 'zway_cmd':
                            command = node.command;
                            switch (command) {
                                case 'on':
                                    payload = payload && payload !== 'off' ? command = 'on' : command = 'off';
                                    break;
                                
                                case 'open':
                                    payload = payload && payload !== 'close' ? command = 'open' : command = 'close';
                                    break;

                                case 'toggle':
                                    var deviceMeta = node.server.getDevice(node.config.device);
                                    if (deviceMeta !== undefined && "deviceType" in deviceMeta && deviceMeta.deviceType === 'switchBinary' && deviceMeta && "metrics" in deviceMeta  && "level" in deviceMeta.metrics) {
                                        if (deviceMeta.metrics.level === 'off') {
                                            command = 'on';
                                        } else {
                                            command = 'off';
                                        }
                                    } else {
                                        command = 'off';
                                    }

                                    break;
                                
                                case 'blinds':
                                    command = 'exactSmooth?level=' + parseFloat(payload);
                                    break;
                                case 'brightness':
                                    command = 'exact?level=' + parseFloat(payload);
                                    break;

                                case 'rgb':
                                    var values = payload.split(',');
                                    command = 'exact?' + 'r=' + parseInt(values[0]) + '&g=' + parseInt(values[1]) + '&b=' + parseInt(values[1]);
                                    break;
                                default: {
                                    break;
                                }
                            }
                            break;

                        case 'homekit':
                            command = node.formatHomeKit(message, payload);
                            break;

                        case 'str':
                        default: {
                            command = node.command;
                            break;
                        }
                    }

                    //empty payload, stop
                    if (payload === null) {
                        return false;
                    }


                    //send data to API
                    var deviceMeta = node.server.getDevice(node.config.device);
                    if (deviceMeta !== undefined && deviceMeta && "id" in deviceMeta) {
                        var url = 'http://' + node.server.ip + ':' + node.server.port + '/ZAutomation/api/v1/devices/' + deviceMeta.id + '/command/';

                        if (node.commandType == 'str') {
                            command = payload;
                        } 

                        if (command == null || command == undefined) {
                            return false;
                        }

                        node.postData(url, command);
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-zway/out:status.device_not_set"
                        });
                        node.cleanTimer = setTimeout(function(){
                            node.status({}); //clean
                        }, 3000);

                    }
                });
            // } else {
            //     node.status({
            //         fill: "red",
            //         shape: "dot",
            //         text: 'Device not set'
            //     });
            // }
        }



        postData(url, command) {
            var node = this;
            // node.log('Requesting url: '+url);
            // console.log(post);
        
            request.get({
                url: url + command
            }, function(error, response, body){
                if (error && typeof(error) === 'object') {
                    node.warn(error);
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-zway/out:status.connection"
                    });

                    node.cleanTimer = setTimeout(function(){
                        node.status({}); //clean
                    }, 3000);
                } else if (body) {
                    var response = JSON.parse(body);

                    if (response.code == 200 && response.message === '200 OK') {
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: "node-red-contrib-zway/out:status.ok"
                        });
                    } else if ('error' in response) {
                        response.error.post = post; //add post data
                        node.warn('zway-out ERROR: '+ response.error.description);
                        node.warn(response.error);
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-zway/out:status.error"
                        });
                    }

                    node.cleanTimer = setTimeout(function(){
                        node.status({}); //clean
                    }, 3000);
                }
            }).auth(node.server.login, node.server.pass);
        }

        formatHomeKit(message, payload) {
            if (message.hap.context === undefined) {
                return null;
            }

            var node = this;
            // var deviceMeta = node.server.getDevice(node.config.device);
            var command;
            if (payload.On !== undefined) {
                command = payload.On ? 'on' : 'off';
            } else if (payload.Brightness !== undefined) {
                command = 'exact?level=' + payload.Brightness
            }  else if (payload.TargetPosition !== undefined) {
                command = 'exact?level=' + payload.TargetPosition
            } else if (payload.LockTargetState !== undefined) {
                if (payload.LockTargetState === 0) {
                    command = "open"
                }
                else if (payload.LockTargetState === 1) {
                    command = "close"
                }
            } else if (payload.TargetHeatingCoolingState !== undefined) {
                command = payload.TargetHeatingCoolingState === 0 ? "off" : "on"
            } else if (payload.TargetTemperature !== undefined) {
                command = 'exact?level=' + payload.TargetTemperature
            }
            
            return command;
        }
    }

    RED.nodes.registerType('zway-output', ZWayOut);
};












