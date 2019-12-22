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

                node.sendLastState(); //tested for duplicate send with onSocketOpen
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
            var uniqueid = node.config.device;
            if (typeof (uniqueid) == 'string' && uniqueid.length) {
                var deviceMeta = node.server.getDevice(uniqueid);
                if (deviceMeta !== undefined) {
                    node.server.devices[node.id] = uniqueid;
                    node.meta = deviceMeta;
                    if (node.config.outputAtStartup) {
                        setTimeout(function () {
                            node.sendMetrics(deviceMeta, true);
                        }, 1500); //we need this timeout after restart of node-red  (homekit delays)
                    } else {
                        setTimeout(function () {
                            node.status({}); //clean
                            node.updateState(deviceMeta);
                            node.sendStateHomekitOnly(deviceMeta); //always send for homekit
                        }, 1500); //update status with the same delay
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-zway/in:status.disconnected"
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/in:status.device_not_set"
                });
            }
        }

        updateState(message) {
            var node = this;

            var device;
            if ("message" in message) {
                device = node.server.getDevice(message.source)
            } else if ("metrics" in message) {
                device = message;
            }

            if (device === undefined || device.metrics.isFailed) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-zway/in:status.not_reachable"
                });
            } else {
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "node-red-contrib-zway/in:status.connected"
                });
            }
            

            if (device !== undefined && device.metrics !== undefined) {
                if (node.oldLevel === undefined && device.metrics.level) { node.oldLevel = device.metrics.level; }
                if (node.prevUpdateTime === undefined && device.updateTime) { node.prevUpdateTime = device.updateTime; }
            } else {
                if (node.oldLevel === undefined && device.message.l) { node.oldLevel = device.message.l; }
                //if (node.prevUpdateTime === undefined && device.updateTime) { node.prevUpdateTime = device.updateTime; }
            }

            return device;
        }

        sendMetrics(device, force=false) {
            var node = this;
            var device = node.updateState(device);
            if (device === undefined) {
                return;
            }
            //filter output
            if (!force && 'onchange' === node.config.output && device.metrics.level === node.oldState) return;
            if (!force && 'onupdate' === node.config.output && device.updateTime === node.prevUpdateTime) return;

            //outputs
            node.send([
                {
                    payload: (node.config.state in device.metrics) ? device.metrics.level : device.metrics,
                    payload_raw: device,
                    meta: node.server.getDevice(node.config.device)
                },
                node.formatHomeKit(device)
            ]);

            // node.oldState = device.message[node.config.state];
            // node.prevUpdateTime = device.state['lastupdated'];
        };

        sendStateHomekitOnly(device) {
            var node = this;
            node.updateState(device);

            //outputs
            node.send([
                null,
                node.formatHomeKit(device)
            ]);
        }

        formatHomeKit(device, options) {
            var node = this;
            var state = device.metrics;

            var no_reponse = false;
            if (state !== undefined && state.isFailed !== undefined && state.isFailed != null && state.isFailed !== false) {
                no_reponse = true;
            }
            if (options !== undefined && "isFailed" in options && !options['isFailed']) {
                no_reponse = true;
            }

            var msg = {};

            var characteristic = {};
            if (state !== undefined) {
                //by types
                if ("deviceType" in device) {
                    switch(device.deviceType) {
                        case 'doorlock':
                            characteristic.LockCurrentState = state.level === 'close' ? 1 : 0;
                            characteristic.LockTargetState = state.level === 'close' ? 1 : 0;
                            break;
                        case "thermostat":
                            if (device.probeType === 'thermostat_set_point') {
                                characteristic.CurrentTemperature == parseFloat(state.level);
                            }
                            break;
                        case 'switchBinary':
                            if (device.probeType === 'thermostat_mode') {
                                if (node.config.thermostat === 'cooling') {
                                    payload.TargetHeatingCoolingState = state.level === 'off' ? 0 : 2
                                } else if (node.config.thermostat === 'heating') {
                                    payload.TargetHeatingCoolingState = state.level === 'off' ? 0 : 1
                                }
                            } else {
                                characteristic.On = state.level === 'on';
                                if (no_reponse) characteristic.On = "NO_RESPONSE";
                            }
                            break;
                        case 'switchMultilevel':
                                var level = parseFloat(state.level);
                                if (device.probeType === 'multilevel') {
                                    if (level !== 0) {
                                        characteristic.Brightness = Math.ceil(level);
                                        characteristic.On = true;
                                    } else {
                                        characteristic.Brightness = 0;
                                        characteristic.On = false;
                                    }
                                } else if (device.probeType === 'motor') {
                                    characteristic.CurrentPosition = Math.ceil(level)
                                    characteristic.TargetPosition = Math.ceil(level)
                                } 
                                //switchColor_soft_white
                                //switchColor_cold_white
                                //switchColor_red
                                //switchColor_green
                                //switchColor_blue
                            break;
                        case 'switchRGB':
                            if (device.probeType === 'switchColor_rgb') {

                            }
                            break;
                        case 'sensorBinary':
                            if (device.probeType === 'general_purpose'       ||
                                device.probeType === 'alarm_burglar'         ||
                                device.probeType === 'motion'                ||
                                device.probeType === 'alarmSensor_burglar'   ||
                                device.probeType === 'alarmSensor_general_purpose') {

                                characteristic.MotionDetected = state.level === 'on'
                                if (no_reponse) characteristic.MotionDetected = "NO_RESPONSE";
                            } else if (device.probeType === 'door-window' ||
                                        device.probeType === 'alarm_door'  ||
                                        device.probeType === 'alarmSensor_door') {

                                characteristic.ContactSensorState = state.level === 'on' ? 1 : 0;
                                if (no_reponse) characteristic.ContactSensorState = "NO_RESPONSE";
                            } else if (device.probeType === 'smoke'       ||
                                        device.probeType === 'alarm_smoke' ||
                                        device.probeType === 'alarmSensor_smoke') {

                                characteristic.SmokeDetected = state.level === 'on' ? 1 : 0;
                                if (no_reponse) characteristic.SmokeDetected = "NO_RESPONSE";

                            } else if (device.probeType === 'flood'       ||
                                        device.probeType === 'alarm_flood' ||
                                        device.probeType === 'alarmSensor_flood') {

                                    characteristic.LeakDetected = state.level === 'on' ? 1 : 0;
                                    if (no_reponse) characteristic.LeakDetected = "NO_RESPONSE";

                            } else if (device.probeType === 'co'       ||
                                        device.probeType === 'alarm_co' ||
                                        device.probeType === 'alarmSensor_co') {
                                    
                                    characteristic.CarbonMonoxideDetected = state.level === 'on' ? 1 : 0;
                                    if (no_reponse) characteristic.CarbonMonoxideDetected = "NO_RESPONSE";
                            }

                            //cooling
                            //tamper

                            // alarm_coo
                            // alarm_heat
                            // alarm_power
                            // alarm_system
                            // alarm_emergency
                            // alarm_clock

                            // alarmSensor_coo
                            // alarmSensor_heat
                            // alarmSensor_power
                            // alarmSensor_system
                            // alarmSensor_emergency
                            // alarmSensor_clock
                            break;
                        case 'sensorMultilevel':
                            if (device.probeType === 'temperature') {
                                characteristic.CurrentTemperature = parseFloat(state.level);
                                if (no_reponse) characteristic.CurrentTemperature = "NO_RESPONSE";
                            } else if (device.probeType === 'luminosity') {
                                characteristic.CurrentAmbientLightLevel = parseFloat(state.level);
                                if (no_reponse) characteristic.CurrentAmbientLightLevel = "NO_RESPONSE";
                            } else if ( device.probeType === 'energy'                       ||
                                        device.probeType === 'meterElectric_kilowatt_hour' ||
                                        device.probeType === 'meterElectric_pulse_count'   ||
                                        device.probeType === 'meterElectric_voltage'       ||
                                        device.probeType === 'meterElectric_ampere'        ||
                                        device.probeType === 'meterElectric_power_factor'  ||
                                        device.probeType === 'meterElectric_kilowatt_per_hour') {
                                        
                                    characteristic.OutletInUse = parseFloat(state.level) > 0 ? true : false;
                                    if (no_reponse) characteristic.OutletInUse = "NO_RESPONSE";
                            } else if (device.probeType === 'humidity') { 
                                characteristic.CurrentRelativeHumidity = parseFloat(state.level);
                                if (no_reponse) characteristic.CurrentRelativeHumidity = "NO_RESPONSE";
                            }

                            // barometer
                            // ultraviolet
                            break;
                            case 'sensorDiscrete':
                                    var level = parseInt(state.level);
                                    if ([10, 20, 30, 40, 50].indexOf(level) >= 0) characteristic.ProgrammableSwitchEvent = 0;
                                    else if ([12, 22, 32, 42, 52].indexOf(level) >= 0) characteristic.ProgrammableSwitchEvent = 2;
                                    if (no_reponse) characteristic.ProgrammableSwitchEvent = "NO_RESPONSE";
            
                                    //index of btn
                                    if (level >= 10 && level < 20) characteristic.ServiceLabelIndex = 1;
                                    else if (level >= 20 && level < 30) characteristic.ServiceLabelIndex = 2;
                                    else if (level >= 30 && level < 40) characteristic.ServiceLabelIndex = 3;
                                    else if (level >= 40 && level < 50) characteristic.ServiceLabelIndex = 4;
                                    else if (level >= 50 && level < 60) characteristic.ServiceLabelIndex = 5;
                            break;
                    }
                // by params
                } else {
                    if (state['ct'] !== undefined) {
                        characteristic.ColorTemperature = state['ct'];
                        if (state['ct'] < 140) characteristic.ColorTemperature = 140;
                        else if (state['ct'] > 500) characteristic.ColorTemperature = 500;
                        if (no_reponse) characteristic.ColorTemperature = "NO_RESPONSE";
                    }
                }
            }

            // //battery status
            // if (config !== undefined) {
            //     if (config['battery'] !== undefined && config['battery'] != null){

            //         if (deviceMeta.deviceType !== 'battery') { //exclude
            //             characteristic.StatusLowBattery = parseInt(deviceMeta['battery']) <= 15 ? 1 : 0;
            //             if (no_reponse) characteristic.StatusLowBattery = "NO_RESPONSE";
            //         }
            //     }
            // }

            if (Object.keys(characteristic).length === 0) return null; //empty response

            msg.payload = characteristic;
            return msg;
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
                text: "node-red-contrib-zway/in:status.reconnecting"
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
                text: "node-red-contrib-zway/in:status.disconnected"
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


