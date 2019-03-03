/**
 *
 * energymanager adapter
 *
 */

'use strict';

const utils = require('@iobroker/adapter-core');
let request = require('request');
let systemLanguage;
let nameTranslation;
let managerIntervall;
let valTagLang;
var url;
var c = request.jar();

let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'energymanager',
        stateChange: function (id, state) {
            let command = id.split('.').pop();
            
            // you can use the ack flag to detect if it is status (true) or command (false)
            if (!state || state.ack) return;
            
            if (command == 'managerReboot') {
                adapter.log.info('energymanager rebooting');
                if (managerIntervall) clearInterval(managerIntervall);
                rebootManager();
                //wait 5 minutes for hardware-reboot
                setTimeout(main, 300000);
            }
        },
        unload: function (callback) {
            try {
                if (managerIntervall) clearInterval(managerIntervall);
                adapter.log.info('cleaned everything up...');
                callback();
            } catch (e) {
                callback();
            }
        },
        ready: function () {
            adapter.getForeignObject('system.config', function (err, obj) {
                if (err) {
                    adapter.log.error(err);
                    return;
                } else if (obj) {
                    if (!obj.common.language) {
                        adapter.log.info("Language not set. English set therefore.");
                        nameTranslation = require(__dirname + '/admin/i18n/en/translations.json')
                    } else {
                        systemLanguage = obj.common.language;
                        nameTranslation = require(__dirname + '/admin/i18n/' + systemLanguage + '/translations.json')
                    }
                    url = "http://" + adapter.config.managerAddress + "/rest";
                    main();
                }
            });
        }
    });
    adapter = new utils.Adapter(options);
    
    return adapter;
};

function rebootManager(){
    request({
        method: 'POST',
        jar: c,
        uri: url+"/login",
        body: JSON.stringify({password: adapter.config.managerPassword})
        }, function (error, response, body) {
            request({jar: c,uri: url+"/reboot",method: 'POST'
            })
    })
}

function translateName(strName) {
    if(nameTranslation[strName]) {
        return nameTranslation[strName];
    } else {
        return strName;
    }
}

function updateState (strGroup,valTag,valTagLang,valType,valUnit,valRole,valValue) {
    adapter.log.debug("strGroup: "+strGroup);
    adapter.setObjectNotExists(
        strGroup + "." + valTag, {
            type: 'state',
            common: {
                name: valTagLang,
                type: valType,
                read: true,
                write: false,
                unit: valUnit,
                role: valRole
            },
            native: {}
        },
        adapter.setState(
            strGroup + "." + valTag,
            {val: valValue, ack: true, expire: (adapter.config.managerIntervall*2)} //value expires if adapter can't pull it from hardware
        )
    );
}

function getManagerValues() {
    request(
        {
            url: "http://" + adapter.config.managerAddress + "/rest/kiwigrid/wizard/devices",
            json: true
        },
        function(error, response, content) {

            if (!error && response.statusCode == 200) {
                
                for (let i in content.result.items) {

                    for (let j in content.result.items[i].tagValues) {
                        
                        let valValue = content.result.items[i].tagValues[j].value;
                        valTagLang = translateName(content.result.items[i].tagValues[j].tagName);
                        let valType = typeof valValue;
                        let valTag = content.result.items[i].tagValues[j].tagName;
                        let strGroup;
                        let valUnit;
                        
                        switch (valType) {
                            case "boolean":
                                var valRole = 'indicator.working';
                                break;
                            
                            case "number":
                                if (valTag.search('Date') > -1){
                                    var valRole = 'value.datetime';
                                    valValue = new Date(valValue);
                                    break;
                                }
                                
                                if (valTag.search('StateOfCharge') == 0){
                                    var valRole = 'value.battery';
                                    break;
                                }
                                if (valTag.search('PowerConsum') == 0 || valTag.search('Work') == 0){
                                    var valRole = 'value.power.consumption';
                                    break;
                                }
                                if (valTag.search('Temperature') == 0){
                                    var valRole = 'value.temperature';
                                    break;
                                }
                                if (valTag.search('Min') > -1 && valTag.search('Minute') == -1){
                                    var valRole = 'value.min';
                                    break;
                                }
                                if (valTag.search('Max') > -1){
                                    var valRole = 'value.max';
                                    break;
                                }
                                var valRole = 'value';
                                break;
                            
                            case "string":
                                var valRole = 'text';
                                break;

                            default:
                                var valRole = 'state';
                                break;
                        }

                        if (valTag.search('Work') == 0){
                            if (adapter.config.managerRounding == "no") {
                                valUnit = 'Wh';
                            } else {
                                valValue = valValue/1000; 
                                valUnit = 'kWh';
                            }
                        } else if (valTag.search('Temperature') == 0) {
                            valUnit = '°C';
                        } else if (valTag.search('Price') == 0) {
                            valUnit = 'ct/kWh';
                        } else if (valTag.search('Degree') == 0) {
                            valUnit = '°';
                        } else if (valTag.search('Voltage') == 0) { 
                            valUnit = 'V';
                        } else if (valTag.search('StateOf') == 0) { 
                            valUnit = '%';
                        } else if (valTag.search('Resistance') == 0) { 
                            valUnit = 'Ohm';
                        } else if (valTag.search('Power') == 0) { 
                            if (adapter.config.managerRounding == "no") {
                                valUnit = 'W';
                            } else {
                                valValue = valValue/1000;    
                                valUnit = 'kW';
                            } 
                        } else {
                            valUnit = '';
                        }

                        if (valType == "number" && valTag.search('Date') == -1) {
                            valValue = Math.round(valValue * 100) / 100;
                        }
                        if (valValue != null) {
                            let IDNameClear = content.result.items[i].tagValues.IdName.value
                                    IDNameClear = IDNameClear
                                        .replace(/[ ]+/g,"_")
                                        .replace(/[\.]+/g,"")
                                        .replace(/[\u00df]+/,"SS");
                            switch(content.result.items[i].deviceModel[1].deviceClass) {
                                case "com.kiwigrid.devices.inverter.Inverter":
                                case "com.kiwigrid.devices.powermeter.PowerMeter":
                                    strGroup=translateName(content.result.items[i].deviceModel[2].deviceClass.split(".").pop()) + "_(" + IDNameClear + ")";
                                break;

                                case "com.kiwigrid.devices.location.Location":
                                case "com.kiwigrid.devices.pvplant.PVPlant":
                                    strGroup=translateName(content.result.items[i].deviceModel[1].deviceClass.split(".").pop()) + "_(" + IDNameClear + ")";
                                    break;
                
                                default:
                                    strGroup=translateName(content.result.items[i].deviceModel[1].deviceClass.split(".").pop());
                                break;
                            }
                        }
                        if (valValue != null && valType != 'object') {
                            updateState (strGroup,valTag,valTagLang,valType,valUnit,valRole,valValue);
                        } /*else if (valValue != null && valType == 'object' && valTag == 'WeatherForecast') {

                            for (var location in valValue) {
                                var jsonObject = JSON.parse(valValue[location]);
                        
                                for ( var day in jsonObject.hourly) {

                                  for (var hour in jsonObject.hourly[day]) {
                                    var datum = new Date(jsonObject.hourly[day][hour].time*1000);
                                    var localOffset = (-1) * datum.getTimezoneOffset() * 60000;
                                    var stamp = new Date((jsonObject.hourly[day][hour].time*1000 + localOffset));
                                    updateState(strGroup+"." + translateName('WeatherForecast') + "." + location + "." + day + "." + hour, 'cloudCover' ,translateName('cloudCover'), 'number','','value',jsonObject.hourly[day][hour].cloudCover);
                                    updateState(strGroup+"." + translateName('WeatherForecast') + "." + location + "." + day + "." + hour, 'temperature' ,translateName('temperature'), 'number','°C','value.temperature',jsonObject.hourly[day][hour].temperature);
                                    updateState(strGroup+"." + translateName('WeatherForecast') + "." + location + "." + day + "." + hour, 'date' ,translateName('date'), 'text','','value.date',stamp);
                                  }
                                }
                            }
                        }*/ 
                    }
                }

            } else {
                adapter.log.error(error);
            }
        }

    )
}

function main() {
    //Button for hardware reboot.
    adapter.setObjectNotExists(
        "managerReboot", {
            type: 'state',
            common: {
                name: translateName("managerReboot"),
                type: 'boolean',
                role: 'button',
                read: true,
                write: true
            },
            native: {}
        },
        adapter.subscribeStates('managerReboot')
    );

    getManagerValues();
    managerIntervall = setInterval(getManagerValues, (adapter.config.managerIntervall * 1000));
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 
